import React, { useState, useMemo } from 'react';
import { InterventionType, MarketState, Point, SimulationResults } from '../types';

interface MarketSimulatorProps {
  id: string;
  title: string;
}

// Chart dimensions
const VIEWBOX_SIZE = 400;
const PADDING = 40;
const GRAPH_WIDTH = VIEWBOX_SIZE - PADDING * 2;
const GRAPH_HEIGHT = VIEWBOX_SIZE - PADDING * 2;

// Max price for visual clamping of infinite surplus
const MAX_PRICE_VISUAL = 120;

const MarketSimulator: React.FC<MarketSimulatorProps> = ({ title }) => {
  // Initial State
  const [state, setState] = useState<MarketState>({
    demandSlope: 1.0,
    demandIntercept: 100,
    isDemandVertical: false,
    demandVerticalQ: 50,

    supplySlope: 1.0,
    supplyIntercept: 10,
    isSupplyVertical: false,
    supplyVerticalQ: 50,

    interventionAmount: 0,
    interventionType: InterventionType.TAX,
  });

  // ---------------------------
  // Handlers
  // ---------------------------
  
  const setVertical = (side: 'demand' | 'supply', isVertical: boolean) => {
    setState(prev => ({ ...prev, [`is${side.charAt(0).toUpperCase() + side.slice(1)}Vertical`]: isVertical }));
  };

  const setPerfectlyElastic = (side: 'demand' | 'supply') => {
    setState(prev => ({ 
      ...prev, 
      [`${side}Slope`]: 0,
      [`is${side.charAt(0).toUpperCase() + side.slice(1)}Vertical`]: false
    }));
  };

  const handleSlopeChange = (side: 'demand' | 'supply', val: number) => {
     setState(prev => ({ 
      ...prev, 
      [`${side}Slope`]: val,
      // If user moves slider, disable vertical mode
      [`is${side.charAt(0).toUpperCase() + side.slice(1)}Vertical`]: false
    }));
  };

  const handleInterceptChange = (side: 'demand' | 'supply', val: number) => {
    setState(prev => ({ ...prev, [`${side}Intercept`]: val }));
  };
  
  const handleVerticalQChange = (side: 'demand' | 'supply', val: number) => {
    setState(prev => ({ ...prev, [`${side}VerticalQ`]: val }));
  };

  const handleInterventionChange = (val: number) => {
    setState(prev => ({ ...prev, interventionAmount: val }));
  };

  const toggleType = (type: InterventionType) => {
    setState(prev => ({ ...prev, interventionType: type }));
  };

  // ---------------------------
  // Math Engine
  // ---------------------------
  const results: SimulationResults = useMemo(() => {
    const { 
      demandSlope, demandIntercept, isDemandVertical, demandVerticalQ,
      supplySlope, supplyIntercept, isSupplyVertical, supplyVerticalQ,
      interventionAmount, interventionType 
    } = state;

    // --- 1. Calculate Equilibrium WITHOUT Intervention (Old) ---
    let qOld = 0, pOld = 0;

    if (isDemandVertical && isSupplyVertical) {
       // Edge case: both vertical. If not same Q, no intersection. Assume visual Q midpoint for sake of stability or 0
       qOld = demandVerticalQ; 
       pOld = 50; // Undefined price really, arbitrary
    } else if (isDemandVertical) {
      // Demand Vertical (Q = Qd), Supply Linear (P = c + dQ)
      qOld = demandVerticalQ;
      pOld = supplyIntercept + supplySlope * qOld;
    } else if (isSupplyVertical) {
      // Supply Vertical (Q = Qs), Demand Linear (P = a - bQ)
      qOld = supplyVerticalQ;
      pOld = demandIntercept - demandSlope * qOld;
    } else {
      // Both Linear
      // a - bQ = c + dQ => Q(b+d) = a - c
      if (demandSlope + supplySlope === 0) {
        qOld = 0; // Parallel horizontal lines
        pOld = 0;
      } else {
        qOld = (demandIntercept - supplyIntercept) / (demandSlope + supplySlope);
        pOld = demandIntercept - demandSlope * qOld;
      }
    }
    qOld = Math.max(0, qOld);
    // P might be negative if curves don't cross in positive quadrant, clamp visually later but keep math raw

    // --- 2. Calculate Equilibrium WITH Intervention (New) ---
    // Tax: Pc - Pp = Tax
    // Subsidy: Pp - Pc = Subsidy  => Pc - Pp = -Subsidy
    // Let Wedge = Tax (positive) or -Subsidy (negative)
    // Eq condition: Pc(Q) - Pp(Q) = Wedge
    
    let wedge = 0;
    if (interventionType === InterventionType.TAX) wedge = interventionAmount;
    if (interventionType === InterventionType.SUBSIDY) wedge = -interventionAmount;

    let qNew = 0, pConsumer = 0, pProducer = 0;

    if (isDemandVertical && isSupplyVertical) {
      qNew = demandVerticalQ;
      // Price is indeterminate, technically tax falls on whoever has less power, but here geometry breaks.
      // Let's keep Q same, prices split wedge around old price? 
      // Standard theory: vertical vs vertical is undefined.
      pConsumer = pOld + wedge / 2;
      pProducer = pOld - wedge / 2;
    } else if (isDemandVertical) {
      // Demand fixed at Q. 
      // Supply shifts.
      // Tax: Supply curve effectively shifts up. Intersection at same Q.
      // So Q doesn't change.
      qNew = demandVerticalQ;
      
      // Supply Price (Willingness to sell) at this Q is fixed by supply curve.
      // Wait. If demand is vertical (perfectly inelastic), CONSUMER bears all tax.
      // Q stays same.
      // Producer price is determined by original supply curve at Q.
      // Pp = S(Q)
      // Pc = Pp + Tax
      
      // What if subsidy?
      // Pp = S(Q). Pc = Pp - Subsidy.
      
      // Original Supply Eq: Pp = c + dQ (if linear)
      // If supply is vertical too? Handled above.
      
      if (isSupplyVertical) {
        // Should be covered by "both vertical" case, but actually logic flows:
        // Vertical Demand + Vertical Supply = No change in Q, price indeterminate.
      } else {
         // Supply is linear: Pp = c + d*Qnew
         pProducer = supplyIntercept + supplySlope * qNew;
         pConsumer = pProducer + wedge;
      }

    } else if (isSupplyVertical) {
      // Supply fixed at Q.
      // Demand shifts? Or tax wedge logic.
      // Vertical Supply (Perfectly Inelastic) => Producer bears all tax.
      // Q stays same.
      qNew = supplyVerticalQ;
      
      // Consumer Price is determined by Demand curve at Q.
      // Pc = D(Q)
      // Pp = Pc - Tax (or Pc + Sub)
      
      if (isDemandVertical) {
        // Handled in "both vertical"
      } else {
        pConsumer = demandIntercept - demandSlope * qNew;
        pProducer = pConsumer - wedge;
      }

    } else {
      // Both Linear
      // Pc = a - bQ
      // Pp = c + dQ
      // Pc - Pp = Wedge
      // (a - bQ) - (c + dQ) = Wedge
      // a - c - Wedge = Q(b + d)
      
      const denominator = demandSlope + supplySlope;
      if (denominator === 0) {
        qNew = 0; 
      } else {
        qNew = (demandIntercept - supplyIntercept - wedge) / denominator;
      }
      qNew = Math.max(0, qNew);
      
      pConsumer = demandIntercept - demandSlope * qNew;
      pProducer = supplyIntercept + supplySlope * qNew;
    }

    // --- 3. Area Calculations ---
    
    // CS = Integral(D) - Pc*Q
    let cs = 0;
    if (isDemandVertical) {
      // Area under vertical line is infinite.
      // We visualy clamp it or set to a "High Value". 
      // For calculation display, we can show "Infinite" string, but type is number.
      // Let's use a proxy large number or max visual.
      // Formula: (VisualMax - Pc) * Q ?
      // Let's calculate CS based on a cap of 150 for "Infinity"
      cs = (150 - pConsumer) * qNew; 
      // Actually, pure theory says infinite. We will display a label if needed.
    } else if (demandSlope === 0) {
        // Horizontal Demand. WTP = Price. CS = 0.
        cs = 0;
    } else {
        // Linear
        // Triangle: 0.5 * (Intercept - Pc) * Q
        cs = 0.5 * (demandIntercept - pConsumer) * qNew;
    }

    // PS = Pp*Q - Integral(S)
    let ps = 0;
    if (isSupplyVertical) {
        // Vertical Supply (Q fixed). 
        // Area under supply curve? Usually vertical supply implies 0 to Q on X axis.
        // The "cost" area is 0 if curve is vertical from 0? 
        // No, vertical supply usually means "Fixed quantity, cost is sunk or irrelevant for marginal decision".
        // PS is whole revenue?
        // Standard interpretation: PS = Area below Pp bounded by S.
        // If S is vertical line at Q, area to left is rectangle Pp * Q.
        // Subtract area under S? Area under a vertical line is 0.
        ps = pProducer * qNew;
    } else if (supplySlope === 0) {
        // Horizontal Supply. MC = Price. PS = 0.
        ps = 0;
    } else {
        // Linear
        // Triangle: 0.5 * (Pp - Intercept) * Q
        ps = 0.5 * (pProducer - supplyIntercept) * qNew;
    }

    // Gov Revenue
    // Tax: Wedge * Q (if tax)
    const govRevenue = interventionType === InterventionType.TAX 
      ? interventionAmount * qNew
      : -(interventionAmount * qNew);

    // DWL
    // Area between Qnew and Qold bounded by Demand and Supply
    // = 0.5 * |Qold - Qnew| * |Wedge|
    // This formula works for linear curves.
    // For vertical curves, Qold = Qnew, so DWL = 0. Correct (Tax doesn't distort Q).
    const dwl = 0.5 * Math.abs(wedge) * Math.abs(qOld - qNew);

    return {
      qOld, pOld, qNew, pConsumer, pProducer, cs, ps, govRevenue, dwl
    };
  }, [state]);

  // ---------------------------
  // Drawing Helpers
  // ---------------------------
  
  const scaleX = (val: number) => PADDING + (val / 100) * GRAPH_WIDTH;
  const scaleY = (val: number) => (VIEWBOX_SIZE - PADDING) - (val / 120) * GRAPH_HEIGHT;

  // --- Points Generation ---

  // Demand Line
  let d1: Point, d2: Point;
  if (state.isDemandVertical) {
    d1 = { x: state.demandVerticalQ, y: 0 };
    d2 = { x: state.demandVerticalQ, y: 120 };
  } else {
    d1 = { x: 0, y: state.demandIntercept };
    // Calculate x at y=0
    const xAtY0 = state.demandSlope === 0 ? 200 : state.demandIntercept / state.demandSlope;
    d2 = { x: Math.min(120, xAtY0), y: state.demandIntercept - state.demandSlope * Math.min(120, xAtY0) };
    // Extend for perfectly elastic (slope 0)
    if (state.demandSlope === 0) d2 = { x: 100, y: state.demandIntercept };
  }

  // Supply Line (Original)
  let s1: Point, s2: Point;
  if (state.isSupplyVertical) {
    s1 = { x: state.supplyVerticalQ, y: 0 };
    s2 = { x: state.supplyVerticalQ, y: 120 };
  } else {
    s1 = { x: 0, y: state.supplyIntercept };
    s2 = { x: 100, y: state.supplyIntercept + state.supplySlope * 100 };
  }

  // Shifted Supply (Visual Only) - Only applicable if Supply is Linear and shifting?
  // If Supply is Vertical, Tax doesn't shift Q, but we can visualize the "effective price" line?
  // Usually we visualize the Tax Wedge rather than a shifted supply curve when dealing with vertical lines, 
  // OR we shift the supply line vertically by Tax.
  
  let shiftedS1 = { ...s1 };
  let shiftedS2 = { ...s2 };
  
  if (!state.isSupplyVertical) {
    // Linear shift
    const shift = state.interventionType === InterventionType.TAX ? state.interventionAmount : -state.interventionAmount;
    shiftedS1.y += shift;
    shiftedS2.y += shift;
  } else {
    // Vertical shift? A vertical line shifted up is the same line.
    // But conceptually P_supply_curve increases.
    // Visually, it's identical. We rely on the Wedge polygon to show the tax.
  }

  // --- Polygon Points ---

  // CS Polygon
  let csPoints = "";
  if (state.isDemandVertical) {
    // Rectangle from Pc to Top
    csPoints = `
      ${scaleX(0)},${scaleY(120)}
      ${scaleX(results.qNew)},${scaleY(120)}
      ${scaleX(results.qNew)},${scaleY(results.pConsumer)}
      ${scaleX(0)},${scaleY(results.pConsumer)}
    `;
  } else if (state.demandSlope === 0) {
    csPoints = ""; // No area
  } else {
    csPoints = `
      ${scaleX(0)},${scaleY(state.demandIntercept)} 
      ${scaleX(results.qNew)},${scaleY(results.pConsumer)} 
      ${scaleX(0)},${scaleY(results.pConsumer)}
    `;
  }

  // PS Polygon
  let psPoints = "";
  if (state.isSupplyVertical) {
    // Rectangle from 0 to Pp (assuming cost is 0/sunk)
    psPoints = `
      ${scaleX(0)},${scaleY(0)}
      ${scaleX(results.qNew)},${scaleY(0)}
      ${scaleX(results.qNew)},${scaleY(results.pProducer)}
      ${scaleX(0)},${scaleY(results.pProducer)}
    `;
  } else if (state.supplySlope === 0) {
    psPoints = ""; // No area
  } else {
    // Standard Triangle
    psPoints = `
      ${scaleX(0)},${scaleY(state.supplyIntercept)} 
      ${scaleX(results.qNew)},${scaleY(results.pProducer)} 
      ${scaleX(0)},${scaleY(results.pProducer)}
    `;
  }

  // Wedge (Tax/Sub)
  const wedgePoints = `
    ${scaleX(0)},${scaleY(results.pConsumer)}
    ${scaleX(results.qNew)},${scaleY(results.pConsumer)}
    ${scaleX(results.qNew)},${scaleY(results.pProducer)}
    ${scaleX(0)},${scaleY(results.pProducer)}
  `;

  // DWL
  let dwlPoints = "";
  if (Math.abs(results.qNew - results.qOld) > 0.1 && state.interventionAmount > 0) {
    dwlPoints = `
      ${scaleX(results.qNew)},${scaleY(results.pConsumer)}
      ${scaleX(results.qOld)},${scaleY(results.pOld)}
      ${scaleX(results.qNew)},${scaleY(results.pProducer)}
    `;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
          {title}
        </h2>
      </div>

      <div className="flex-1 p-6 flex flex-col xl:flex-row gap-8">
        {/* Controls Column */}
        <div className="w-full xl:w-5/12 space-y-6">
          
          {/* Demand Controls */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold text-slate-700">Demand (PED)</label>
              <div className="flex gap-1">
                 <button 
                  onClick={() => setPerfectlyElastic('demand')}
                  className={`text-xs px-2 py-1 rounded ${state.demandSlope === 0 && !state.isDemandVertical ? 'bg-blue-600 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
                  title="Perfectly Elastic (Horizontal)"
                >
                  Flat
                </button>
                <button 
                  onClick={() => setVertical('demand', !state.isDemandVertical)}
                  className={`text-xs px-2 py-1 rounded ${state.isDemandVertical ? 'bg-blue-600 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
                  title="Perfectly Inelastic (Vertical)"
                >
                  Vertical
                </button>
              </div>
            </div>

            {state.isDemandVertical ? (
               <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Quantity Fixed</span>
                  <span>{state.demandVerticalQ}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={state.demandVerticalQ}
                  onChange={(e) => handleVerticalQChange('demand', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                   <span>Slope: {state.demandSlope.toFixed(1)}</span>
                   <span>Intercept: {state.demandIntercept}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-xs w-8">Slope</span>
                   <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={state.demandSlope}
                    onChange={(e) => handleSlopeChange('demand', parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                 <div className="flex items-center gap-2">
                   <span className="text-xs w-8">Int</span>
                   <input
                    type="range"
                    min="50"
                    max="120"
                    step="1"
                    value={state.demandIntercept}
                    onChange={(e) => handleInterceptChange('demand', parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Supply Controls */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold text-slate-700">Supply (PES)</label>
               <div className="flex gap-1">
                 <button 
                  onClick={() => setPerfectlyElastic('supply')}
                  className={`text-xs px-2 py-1 rounded ${state.supplySlope === 0 && !state.isSupplyVertical ? 'bg-red-600 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
                  title="Perfectly Elastic (Horizontal)"
                >
                  Flat
                </button>
                <button 
                  onClick={() => setVertical('supply', !state.isSupplyVertical)}
                  className={`text-xs px-2 py-1 rounded ${state.isSupplyVertical ? 'bg-red-600 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
                  title="Perfectly Inelastic (Vertical)"
                >
                  Vertical
                </button>
              </div>
            </div>

             {state.isSupplyVertical ? (
               <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Quantity Fixed</span>
                  <span>{state.supplyVerticalQ}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={state.supplyVerticalQ}
                  onChange={(e) => handleVerticalQChange('supply', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                   <span>Slope: {state.supplySlope.toFixed(1)}</span>
                   <span>Intercept: {state.supplyIntercept}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-xs w-8">Slope</span>
                   <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={state.supplySlope}
                    onChange={(e) => handleSlopeChange('supply', parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                 <div className="flex items-center gap-2">
                   <span className="text-xs w-8">Int</span>
                   <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={state.supplyIntercept}
                    onChange={(e) => handleInterceptChange('supply', parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-red-100 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Intervention Controls */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Government Policy</label>
            
            <div className="flex bg-slate-200 p-1 rounded-lg mb-4">
              <button
                onClick={() => toggleType(InterventionType.TAX)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  state.interventionType === InterventionType.TAX
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Tax
              </button>
              <button
                onClick={() => toggleType(InterventionType.SUBSIDY)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  state.interventionType === InterventionType.SUBSIDY
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Subsidy
              </button>
            </div>

            <div className="mb-2">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">Amount ($)</span>
                <span className="font-mono font-bold">{state.interventionAmount}</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={state.interventionAmount}
                onChange={(e) => handleInterventionChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Results Summary */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-blue-50 p-2.5 rounded border border-blue-100">
              <div className="text-blue-500 font-medium text-[10px] uppercase tracking-wider">Consumer Surplus</div>
              <div className="font-bold text-slate-800 text-lg">
                {state.isDemandVertical ? '∞' : results.cs.toFixed(1)}
              </div>
            </div>
            <div className="bg-red-50 p-2.5 rounded border border-red-100">
              <div className="text-red-500 font-medium text-[10px] uppercase tracking-wider">Producer Surplus</div>
              <div className="font-bold text-slate-800 text-lg">{results.ps.toFixed(1)}</div>
            </div>
            <div className={`${results.govRevenue >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-yellow-50 border-yellow-100'} p-2.5 rounded border`}>
              <div className={`${results.govRevenue >= 0 ? 'text-emerald-600' : 'text-yellow-600'} font-medium text-[10px] uppercase tracking-wider`}>
                {state.interventionType === InterventionType.TAX ? 'Tax Rev' : 'Sub Cost'}
              </div>
              <div className="font-bold text-slate-800 text-lg">{Math.abs(results.govRevenue).toFixed(1)}</div>
            </div>
             <div className="bg-gray-100 p-2.5 rounded border border-gray-200">
              <div className="text-gray-500 font-medium text-[10px] uppercase tracking-wider">Deadweight Loss</div>
              <div className="font-bold text-slate-800 text-lg">{results.dwl.toFixed(1)}</div>
            </div>
          </div>

        </div>

        {/* Visual Column */}
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl relative min-h-[300px]">
           <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} className="w-full h-full max-w-md drop-shadow-sm overflow-visible">
              {/* Axes */}
              <line x1={scaleX(0)} y1={scaleY(0)} x2={scaleX(100)} y2={scaleY(0)} stroke="#94a3b8" strokeWidth="2" />
              <line x1={scaleX(0)} y1={scaleY(0)} x2={scaleX(0)} y2={scaleY(120)} stroke="#94a3b8" strokeWidth="2" />
              
              <text x={scaleX(98)} y={scaleY(-5)} className="text-xs fill-slate-500 font-bold">Q</text>
              <text x={scaleX(-5)} y={scaleY(118)} className="text-xs fill-slate-500 font-bold">P</text>

              {/* Areas */}
              {state.interventionAmount >= 0 && (
                <>
                  {/* CS */}
                  <polygon points={csPoints} fill="rgba(59, 130, 246, 0.2)" stroke="none" />
                  {/* PS */}
                  <polygon points={psPoints} fill="rgba(239, 68, 68, 0.2)" stroke="none" />
                  {/* Wedge */}
                  <polygon 
                    points={wedgePoints} 
                    fill={state.interventionType === InterventionType.TAX ? "rgba(16, 185, 129, 0.2)" : "rgba(234, 179, 8, 0.2)"} 
                    stroke="none"
                  />
                  {/* DWL */}
                  <polygon points={dwlPoints} fill="rgba(107, 114, 128, 0.4)" stroke="none" />
                </>
              )}

              {/* Curves */}
              
              {/* Supply Line */}
              <line 
                x1={scaleX(s1.x)} y1={scaleY(s1.y)} 
                x2={scaleX(s2.x)} y2={scaleY(s2.y)} 
                stroke="#ef4444" 
                strokeWidth="3" 
                className={!state.isSupplyVertical && state.interventionAmount > 0 ? "opacity-40 stroke-dasharray-2" : ""}
                strokeDasharray={!state.isSupplyVertical && state.interventionAmount > 0 ? "5,5" : ""}
              />
               {state.isSupplyVertical ? (
                  <text x={scaleX(s2.x)} y={scaleY(122)} className="text-xs fill-red-500 font-bold text-center">S</text>
               ) : (
                  <text x={scaleX(s2.x)} y={scaleY(s2.y)} className="text-xs fill-red-500 font-bold">S</text>
               )}


               {/* Shifted Supply (if linear) */}
               {state.interventionAmount > 0 && !state.isSupplyVertical && (
                  <>
                    <line 
                      x1={scaleX(shiftedS1.x)} y1={scaleY(shiftedS1.y)} 
                      x2={scaleX(shiftedS2.x)} y2={scaleY(shiftedS2.y)} 
                      stroke="#ef4444" 
                      strokeWidth="3" 
                    />
                    <text x={scaleX(shiftedS2.x)} y={scaleY(shiftedS2.y)} className="text-xs fill-red-600 font-bold">
                       {state.interventionType === InterventionType.TAX ? 'S+Tax' : 'S-Sub'}
                    </text>
                  </>
               )}

              {/* Demand Line */}
              <line 
                x1={scaleX(d1.x)} y1={scaleY(d1.y)} 
                x2={scaleX(d2.x)} y2={scaleY(d2.y)} 
                stroke="#3b82f6" 
                strokeWidth="3" 
              />
              {state.isDemandVertical ? (
                 <text x={scaleX(d1.x)} y={scaleY(122)} className="text-xs fill-blue-500 font-bold">D</text>
              ) : (
                 <text x={scaleX(d2.x)} y={scaleY(d2.y)} className="text-xs fill-blue-500 font-bold">D</text>
              )}
              

              {/* Equilibrium Points */}
              <circle cx={scaleX(results.qNew)} cy={scaleY(results.pConsumer)} r="4" fill="#3b82f6" className="stroke-white stroke-2" />
              <circle cx={scaleX(results.qNew)} cy={scaleY(results.pProducer)} r="4" fill="#ef4444" className="stroke-white stroke-2" />

              {/* Dashed Guides */}
              <line x1={scaleX(0)} y1={scaleY(results.pConsumer)} x2={scaleX(results.qNew)} y2={scaleY(results.pConsumer)} stroke="#cbd5e1" strokeDasharray="4,4" />
              <line x1={scaleX(0)} y1={scaleY(results.pProducer)} x2={scaleX(results.qNew)} y2={scaleY(results.pProducer)} stroke="#cbd5e1" strokeDasharray="4,4" />
              <line x1={scaleX(results.qNew)} y1={scaleY(0)} x2={scaleX(results.qNew)} y2={scaleY(Math.min(results.pConsumer, results.pProducer))} stroke="#cbd5e1" strokeDasharray="4,4" />

              {/* Price/Qty Labels */}
              <text x={scaleX(-8)} y={scaleY(results.pConsumer)+4} className="text-[10px] fill-blue-600 font-mono font-bold">Pc</text>
              <text x={scaleX(-8)} y={scaleY(results.pProducer)+4} className="text-[10px] fill-red-600 font-mono font-bold">Pp</text>
              <text x={scaleX(results.qNew)-5} y={scaleY(-8)} className="text-[10px] fill-slate-600 font-mono font-bold">Q*</text>

           </svg>
        </div>
      </div>
    </div>
  );
};

export default MarketSimulator;
