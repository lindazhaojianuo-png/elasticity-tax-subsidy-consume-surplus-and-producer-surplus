export enum InterventionType {
  NONE = 'None',
  TAX = 'Tax',
  SUBSIDY = 'Subsidy'
}

export interface MarketState {
  // Linear params (P = intercept +/- slope * Q)
  demandSlope: number; 
  demandIntercept: number;
  
  supplySlope: number; 
  supplyIntercept: number;

  // Vertical params (Perfectly Inelastic)
  isDemandVertical: boolean;
  demandVerticalQ: number;

  isSupplyVertical: boolean;
  supplyVerticalQ: number;

  interventionAmount: number;
  interventionType: InterventionType;
}

export interface Point {
  x: number;
  y: number;
}

export interface SimulationResults {
  qOld: number;
  pOld: number;
  qNew: number;
  pConsumer: number;
  pProducer: number;
  cs: number;
  ps: number;
  govRevenue: number; // Negative for subsidy cost
  dwl: number;
}
