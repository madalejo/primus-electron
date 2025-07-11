import { useState, useEffect, useRef } from 'react'
import { Button } from './components/ui/button'
import { Mic, MicOff } from 'lucide-react';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import ethos100 from "./assets/ethos100.png"
import './App.css'

type deviceProps = {
  manufacturer: string
  product: string
  serialNumber: string
  vendorId: string
  productId: string
}

function App() {
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0);
  const [deviceInfo, setDeviceInfo] = useState<deviceProps | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastVolumeRef = useRef(0);

  // track consecutive silence samples to avoid false trigger
  const silenceCountRef = useRef(0);
  const SILENCE_THRESHOLD = 0.005; // lower will detect true silence
  const SILENCE_COUNT_TRIGGER = 10;// amount of consecutive low readings

  // debuggin
  const [debugInfo, setDebugInfo] = useState<string>('');

  const toggleMute = () => {
    //setIsMuted(!isMuted);
    if(isMonitoring) {
      //if monitoring just stop
      stopMonitoring();
    } else {
      // start monitoring
      if (!deviceInfo) {
        identifyDevice();
      } else {
        startMonitoring();
      }
    }
  }

  useEffect(() => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContext();

    //cleanup unmount
    return () => {
      stopMonitoring();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  },[])

  // Find and connect to the PM101 using webUSB
  const identifyDevice = async () => {
    try {
      // identify PM101 mic via websusb
      const filters = [
        // USB audio device classes
        { classCode: 1 },
      ];

        try {
          const device = await (navigator as any).usb.requestDevice({ filters });
          console.log('USB Device found: ', device);

          const info = {
            manufacturer: device.manufacturerName || 'Unknown',
            product: device.productName || 'Unknown',
            serialNumber: device.serialNumber || 'Unknown',
            vendorId: device.vendorId.toString(16),
            productId: device.productId.toString(16),
          };
          
          setDeviceInfo(info);
        } catch (usbError) {
          console.log('WebUSB not available or no device selected:', usbError);
          // Fall back to just setting a generic device info
          setDeviceInfo({
            manufacturer: 'Primus',
            product: 'ETHOS100T',
            serialNumber: 'Unknown',
            vendorId: 'Unknown',
            productId: 'Unknown',
          });
        }
    
      // Now start audio monitoring regardless of USB detection
      startMonitoring();

    } catch (error) {
      console.error('Error in device identification:', error);
      setDebugInfo(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Start monitoring microphone audio
  const startMonitoring = async () => {
    try {
      // First, stop any existing monitoring
      stopMonitoring();
      
      // Request access to the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          // We're setting echoCancellation to false to get raw audio data
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }, 
        video: false 
      });
      
      streamRef.current = stream;
      
      // Create source and analyser nodes
      const audioContext = audioContextRef.current;
      if (!audioContext) return;
      
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024; // Higher FFT size for more accurate analysis
      analyser.smoothingTimeConstant = 0.5; // Add some smoothing
      analyserRef.current = analyser;
      
      // Connect the source to the analyser
      source.connect(analyser);
      
      // Start monitoring volume
      setIsMonitoring(true);
      
      // Reset silence counter
      silenceCountRef.current = 0;
      
      // Call the volume checking function
      checkVolume();
      
      // Initial state - assume unmuted until we detect otherwise
      setIsMuted(false);
      
      setDebugInfo("Monitoring started");
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsMonitoring(false);
      setIsMuted(true);
      setDebugInfo(`Mic Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Stop monitoring
  const stopMonitoring = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setIsMonitoring(false);
    setIsMuted(true);
    setVolume(0);
    setDebugInfo("Monitoring stopped");
  };

  // Check volume levels
  const checkVolume = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate volume level (average of frequency data)
      let sum = 0;
      let activeBins = 0;
      
      // Focus on frequencies typically found in speech (roughly 85-255Hz)
      // This helps ignore background noise
      const minBin = Math.floor(85 * bufferLength / (audioContextRef.current?.sampleRate || 44100) * 2);
      const maxBin = Math.floor(255 * bufferLength / (audioContextRef.current?.sampleRate || 44100) * 2);
      
      for (let i = minBin; i < maxBin; i++) {
        if (i < dataArray.length) {
          sum += dataArray[i];
          if (dataArray[i] > 0) activeBins++;
        }
      }
      
      const binCount = maxBin - minBin;
      const avg = sum / (binCount > 0 ? binCount : 1);
      const normalized = avg / 255; // Normalize to 0-1 range
      
      setVolume(normalized);
      lastVolumeRef.current = normalized;
      
      // Debug info
      setDebugInfo(`Volume: ${normalized.toFixed(6)}, Silence Count: ${silenceCountRef.current}`);
      
      // Mute detection logic
      if (normalized < SILENCE_THRESHOLD) {
        silenceCountRef.current++;
        
        if (silenceCountRef.current >= SILENCE_COUNT_TRIGGER && !isMuted) {
          // Consistently silent - mic is likely muted
          setIsMuted(true);
        }
      } else {
        // Reset silence counter if we detect sound
        silenceCountRef.current = 0;
        
        // If we were previously muted but now detect sound, unmute
        if (isMuted) {
          setIsMuted(false);
        }
      }
      
      // Continue the monitoring loop
      animationRef.current = requestAnimationFrame(updateVolume);
    };
    
    updateVolume();
  };


  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 to-violet-800 flex flex-col items-center justify-center p-6 text-white">
      <div className="max-w-sm w-full mx-auto text-center space-y-8">
        {/* Status Indicator */}
        <div className="space-y-2">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            isMuted 
              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
              : 'bg-green-500/20 text-green-400 border border-green-500/30'
          }`}>
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isMuted ? 'Microphone Muted' : 'Microphone Active'}
          </div>
        </div>

        {/* Microphone Image */}
        <div className="relative">
          <div className={`w-64 h-64 mx-auto rounded-full p-4 transition-all duration-300 ${
            isMuted 
              ? 'bg-red-500/10 shadow-lg shadow-red-500/20' 
              : 'bg-green-500/10 shadow-lg shadow-green-500/20'
          }`}>
            <ImageWithFallback
              src={ethos100}
              alt="Professional podcast microphone"
              className={`w-full h-full object-cover rounded-full transition-all duration-300 ${
                isMuted ? 'grayscale opacity-60' : 'grayscale-0 opacity-100'
              }`}
            />
          </div>
          
          {/* Pulse animation when active */}
          {!isMuted && (
            <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping"></div>
          )}
        </div>

        {/* Control Button */}
        <div className="space-y-4 z-10 relative">
          <Button
            onClick={toggleMute}
            size="lg"
            className={`w-full h-14 text-lg font-medium transition-all duration-200 ${
              !isMonitoring
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25'
                : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/25'
            }`}
          >
            {!isMonitoring ? (
              <>
                <MicOff className="w-5 h-5 mr-2" />
                Start Monitoring
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Stop Monitoring
              </>
            )}
          </Button>
          
          <p className="text-sm text-slate-400">
            {isMonitoring 
            ? 'Monitoring micrphone state...' 
            : 'Tap to start monitoring your microphone'}
          </p>
        </div>

        {/* Volume Meter */}
        {isMonitoring && (
          <div className="space-y-2">
            <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
              <div 
                className={`h-full transition-all duration-100 ${
                  isMuted ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(volume * 100 * 5, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400">Volume level: {(volume * 100).toFixed(2)}%</p>
          </div>
        )}

        {/* Device Info (if available) */}
        {deviceInfo && (
          <div className="mt-4 text-xs text-slate-300 bg-slate-800/50 p-3 rounded-lg">
            <p>Device: {deviceInfo.product}</p>
            <p>Manufacturer: {deviceInfo.manufacturer}</p>
            {deviceInfo.vendorId !== 'Unknown' && (
              <p>ID: {deviceInfo.vendorId}:{deviceInfo.productId}</p>
            )}
          </div>
        )}

         {/* Debug info - you can remove this in production */}
        <div className="text-xs text-slate-400 opacity-60">
          {debugInfo}
        </div>

      </div>
    </div>
  )
}

export default App
