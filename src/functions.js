import { co2 } from "@tgwf/co2"; 

export class Co2Component {

  emissions = { weight: 0, co2weight: 0 };
  
  allowCheck = false;
  getCo2Check = false;
  #MAX_RETRIES = 3;
  #RETRY_DELAY = 1000;
  #EXCLUDED_DOMAINS = [
    "https://cloudflare-dns.com/dns-query?",
    "https://api.thegreenwebfoundation.org/api/v3/greencheck/",
    "https://api.thegreenwebfoundation.org/api/v3/ip-to-co2intensity"
  ];

  gridIntensityOptionsDefault = {
    gridIntensity: {
      device: { country: "FRA" },
      dataCenter: 207,
      network: { country: "FRA" }
    }
  };

  lastStartTime = 0;
  componentsDeltaCheck = [];

  constructor() {
    window.addEventListener("load", async () => {
      console.log(this.firstEstimationCo2());
      this.emissions = this.firstEstimationCo2();
      this.getCo2Check = true;

      console.log(this.emissions);

      setTimeout(async () => {
        this.getCo2Check = false;
        this.emissions = await this.getInitialPageWeightInKB();
      }, 2000);

    });
  }

  getCurrentCo2() {
    if (this.getCo2Check) {
      return this.emissions;
    }
  }

  isExcludedDomain(resourceName) {
    return this.#EXCLUDED_DOMAINS.some(domain => resourceName.includes(domain));
  }

  resetState() {
    this.lastStartTime = 0;
    this.componentsDeltaCheck = [];
  }

  async retryOperation(operation, maxRetries = this.#MAX_RETRIES) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.race([
          operation(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Operation timeout")), 5000)
          )
        ]);
      } catch (error) {
        lastError = error;
        console.warn(`Tentative ${attempt + 1}/${maxRetries + 1} échouée:`, error);

        if (attempt < maxRetries) {
          const delay = this.#RETRY_DELAY * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  firstEstimationCo2() {
    const relevantResources = this.getRelevantResources(0);
    this.resetState();

    const totalBytes = relevantResources.reduce((sum, res) => {
      const size =
        res.encodedBodySize || res.decodedBodySize || res.transferSize || 0;
      return sum + size;
    }, 0);

    console.log(Number(this.getCo2byItem(totalBytes, false, this.gridIntensityOptionsDefault).toFixed(3)));
    return {
      weight: totalBytes,
      co2weight: Number(
        this.getCo2byItem(totalBytes, false, this.gridIntensityOptionsDefault).toFixed(3)
      )
    };
  }

  async getInitialPageWeightInKB() {
    const relevantResources = this.getRelevantResources(0);
    let pageValues = { weight: 0, co2weight: 0 };
    pageValues = await this.getPageValues(pageValues, relevantResources);
    pageValues.co2weight = Number(pageValues.co2weight.toFixed(3));
    this.allowCheck = true;
    return pageValues;
  }



  getRelevantResources(startTime) {
    const resources = performance.getEntriesByType("resource");
    const relevantResources = resources.filter(res => res.startTime > startTime);
    const filteredResources = relevantResources.filter(
      element => !this.isExcludedDomain(element.name)
    );

    this.componentsDeltaCheck = this.componentsDeltaCheck.concat(filteredResources);
    this.lastStartTime =
      filteredResources.length > 0
        ? filteredResources[filteredResources.length - 1].startTime
        : this.lastStartTime;

    return filteredResources;
  }

  async getPageValues(pageValues, relevantResources) {
    console.log("Calculating page values for resources:", relevantResources);
    if (relevantResources.length === 0) return pageValues;

    for (const res of relevantResources) {
      try {
        const size =
          res.encodedBodySize || res.decodedBodySize || res.transferSize || 0;
        pageValues.weight += size;

        let domain;
        if (res.name.split("/")[2].split("www.")[1]) {
          domain = res.name.split("/")[2].split("www.")[1];
        } else {
          domain = res.name.split("/")[2];
        }

        const isgreen = await this.retryOperation(() => this.getIsGreen(domain));
        const co2CalculOptions = await this.retryOperation(() =>
          this.getOptionsCo2(size, domain)
        );
        console.log("last step before co2 calculation");
        const co2weightResult = this.getCo2byItem(
          size,
          isgreen,
          co2CalculOptions
        );

        pageValues.co2weight += co2weightResult;
        console.log(co2weightResult);
      } catch (error) {
        console.error("Error processing resource:", res.name, error);
      }
      this.lastStartTime = res.startTime;
    }
    return pageValues;
  }

  async getDomainIP(domain) {
    try {
      const response = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
        { headers: { Accept: "application/dns-json" } }
      );
      const data = await response.json();
      if (data.Answer && data.Answer.length > 0) {
        return data.Answer[0].data;
      }
    } catch (error) {
      console.error("DoH lookup failed for", domain, error);
    }
    return null;
  }

  async getIsGreen(domain) {
    try {
      const response = await fetch(
        `https://api.thegreenwebfoundation.org/api/v3/greencheck/${domain}`
      );
      const data = await response.json();
      return data.green;
    } catch {
      return false;
    }
  }

  async getOptionsCo2(size, domain) {
    const ipAddress = await this.retryOperation(() => this.getDomainIP(domain));
    let options;

    if (ipAddress) {
      try {
        const response = await fetch(
          `https://api.thegreenwebfoundation.org/api/v3/ip-to-co2intensity/${ipAddress}`
        );
        const data = await response.json();
        options = {
          gridIntensity: {
            device: { country: "FRA" },
            dataCenter: data.carbon_intensity || 460,
            network: { country: data.country_code_iso_3 || "FRA" }
          }
        };
      } catch (error) {
        console.error("Failed to get carbon intensity for IP:", error);
        options = this.gridIntensityOptionsDefault;
      }
    } else {
      options = this.gridIntensityOptionsDefault;
    }
    return options;
  }

  getCo2byItem(item, greenHosting, options) {
    console.log("Calculating CO2 for item:", item);
    try {
      const oneByte = new co2({ model: "1byte" });
      const result = oneByte.perByteTrace(item, greenHosting, options);
      console.log("CO2 Calculation Result:", result);
      return Number(result.co2);
    } catch (err) {
      console.error("Erreur calcul CO2:", err);
      return 0;
    }
  }
}
