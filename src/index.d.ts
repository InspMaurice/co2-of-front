declare module 'co2-of-front' {
  export class Co2Component {
    emissions: { weight: number; co2weight: number };
    currentState: number;
    allowCheck: boolean;
    constructor();
    getCurrentCo2(): { weight: number; co2weight: number };
    changeDefaultGridIntensity(newIntensity: object): void;
  }

  export class ExtendedCo2Component extends Co2Component {
    doCheck(): void;
    getUpdatedPageWeightInKB(pageValues: any): Promise<any>;
  }
}