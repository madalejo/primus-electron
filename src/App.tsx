import { useState } from 'react'
import { Button } from './components/ui/button'
import { Mic, MicOff } from 'lucide-react';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import ethos100 from "./assets/ethos100.png"
import './App.css'

function App() {
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  }

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
              isMuted
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25'
                : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/25'
            }`}
          >
            {isMuted ? (
              <>
                <MicOff className="w-5 h-5 mr-2" />
                Unmute Microphone
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Mute Microphone
              </>
            )}
          </Button>
          
          <p className="text-sm text-slate-400">
            Tap to {isMuted ? 'unmute' : 'mute'} your microphone
          </p>
        </div>

        {/* Visual Status Bar */}
        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              isMuted ? 'w-0 bg-red-500' : 'w-full bg-green-500'
            }`}
          ></div>
        </div>
      </div>
    </div>
  )
}

export default App
