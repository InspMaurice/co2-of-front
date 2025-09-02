declare module 'co2-of-front' {
  export class Co2Component {
    emissions: { weight: number; co2weight: number };
    allowCheck: boolean;
    constructor();
    // Ajoutez ici les méthodes publiques si besoin
  }

  export class ExtendedCo2Component extends Co2Component {
    doCheck(): void;
    getUpdatedPageWeightInKB(pageValues: any): Promise<any>;
  }
}