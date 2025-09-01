import { Co2Component } from "./functions";

class ExtendedCo2Component extends Co2Component {
    // Boucle continue → remplace ngDoCheck
    // Décommentez pour activer la boucle automatique
    // constructor() {
    //   super();
    //   const checkLoop = () => {
    //     this.doCheck();
    //     requestAnimationFrame(checkLoop);
    //   };
    //   requestAnimationFrame(checkLoop);
    // }

    doCheck() {
        if (!this.allowCheck) return;

        const currentResources = performance.getEntriesByType("resource")
            .filter(res => res.startTime > 0)
            .filter(element => !this.isExcludedDomain(element.name)); 

        if (currentResources.length === 0) return;

        if (this.componentsDeltaCheck.length !== currentResources.length) {
            this.allowCheck = false;

            setTimeout(async () => {
                try {
                    this.emissions = await this.getUpdatedPageWeightInKB(this.emissions);
                } catch (err) {
                    console.error("Erreur lors de la mise à jour CO2:", err);
                }
                this.allowCheck = true;
            }, 1000);
        }
    }

    async getUpdatedPageWeightInKB(pageValues) {
        const relevantResources = this.getRelevantResources(this.lastStartTime);
        pageValues = await this.getPageValues(pageValues, relevantResources);
        pageValues.co2weight = Number(pageValues.co2weight.toFixed(3));
        return pageValues;
    }
}

export { ExtendedCo2Component };
