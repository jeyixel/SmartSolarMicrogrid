import React from 'react';
import { Button } from '@/components/ui/button';
import { Sun, Zap, ShieldCheck } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 space-y-6">
      <header className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-2">
          <Sun className="w-10 h-10 animate-spin-slow" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Smart Solar Microgrid</h1>
        <p className="text-muted-foreground text-lg max-w-md">
          Web Client Dashboard for Real-time Energy & Solar Monitoring
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button variant="default" className="gap-2">
          <Zap className="w-4 h-4" /> Connect System
        </Button>
        <Button variant="outline" className="gap-2">
          <ShieldCheck className="w-4 h-4" /> Security Status
        </Button>
      </div>
    </div>
  );
}

export default App;
