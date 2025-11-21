import React from 'react';
import MarketSimulator from './components/MarketSimulator';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <header className="max-w-7xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
          Welfare Analysis Simulator
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Analyze the effects of Taxes and Subsidies on Consumer Surplus (CS) and Producer Surplus (PS) 
          under varying elasticities. Compare two scenarios side-by-side.
        </p>
      </header>

      <main className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MarketSimulator id="sim-1" title="Market Panel A" />
        <MarketSimulator id="sim-2" title="Market Panel B" />
      </main>

      <footer className="max-w-7xl mx-auto mt-12 text-center text-slate-400 text-sm">
        <div className="flex justify-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500/50 rounded-sm"></div>
            <span>Consumer Surplus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500/50 rounded-sm"></div>
            <span>Producer Surplus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500/50 rounded-sm"></div>
            <span>Gov Revenue</span>
          </div>
           <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500/50 rounded-sm"></div>
            <span>Deadweight Loss</span>
          </div>
        </div>
        <p>© 2024 EconVis Simulator. Built with React & Tailwind.</p>
      </footer>
    </div>
  );
};

export default App;