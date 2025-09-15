import { co2 } from "@tgwf/co2"; 

export class Co2Component {

  emissions = { weight: 0, co2weight: 0 };
  
  allowCheck = false;
  currentState=0;
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

  /*
  List of variables:
  emissions: Object holding the current emissions data (weight and co2weight).
  allowCheck: Boolean flag to indicate if further checks are allowed (useful only if the ExtendedCo2Component is used).
  currentState: Integer representing the current state of the component (0: initial, 1: after first estimation, 2: after detailed calculation).
  #MAX_RETRIES: Private constant defining the maximum number of retries for network operations.
  #RETRY_DELAY: Private constant defining the base delay (in ms) for retries, which increases exponentially with each attempt.
  #EXCLUDED_DOMAINS: Array of the domains used to fetch data for CO2 calculations, which should be excluded from the emissions calculations (logical reason).
  gridIntensityOptionsDefault: Default options for grid intensity used in CO2 calculations when specific data is unavailable.
  lastStartTime: Timestamp of the last resource check, used to filter new resources.
  componentsDeltaCheck: Array holding resources that have been checked since the last reset, useful for delta calculations.
  */
  

  constructor() {
    window.addEventListener("load", async () => {
      this.emissions = this.firstEstimationCo2();
      this.currentState=1;


      setTimeout(async () => {
        this.emissions = await this.getInitialPageWeightInKB();
        this.currentState=2;
      }, 2000);

    });
  }

  getCurrentCo2() {
    return this.emissions;
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

  // Simple initial estimation based on resources loaded at page load
  firstEstimationCo2() {
    const relevantResources = this.getRelevantResources(0);
    this.resetState();

    const totalBytes = relevantResources.reduce((sum, res) => {
      const size =
        res.encodedBodySize || res.decodedBodySize || res.transferSize || 0;
      return sum + size;
    }, 0);

    return {
      weight: totalBytes,
      co2weight: Number(
        this.getCo2byItem(totalBytes, false, this.gridIntensityOptionsDefault).toFixed(3)
      )
    };
  }

  // Detailed calculation after initial estimation, considering all resources loaded after page load
  async getInitialPageWeightInKB() {
    const relevantResources = this.getRelevantResources(0);
    let pageValues = { weight: 0, co2weight: 0 };
    pageValues = await this.getPageValues(pageValues, relevantResources);
    pageValues.co2weight = Number(pageValues.co2weight.toFixed(3));
    this.allowCheck = true;
    return pageValues;
  }


  // Get resources loaded after a specific start time, excluding certain domains
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

  // Process each resource to calculate total weight and CO2 emissions  
  async getPageValues(pageValues, relevantResources) {
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
        const co2weightResult = this.getCo2byItem(
          size,
          isgreen,
          co2CalculOptions
        );

        pageValues.co2weight += co2weightResult;
      } catch (error) {
        console.error("Error processing resource:", res.name, error);
      }
      this.lastStartTime = res.startTime;
    }
    console.log("Page values updated:", pageValues);
    return pageValues;
  }

  // Get the IP address of a domain using DNS over HTTPS
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

  // Check if a domain is hosted on green energy
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

  // Get CO2 intensity options based on the IP address of the domain (if its values are known)
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

  // Calculate CO2 emissions for a given item size, considering if the hosting is green and specific options
  getCo2byItem(item, greenHosting, options) {
    try {
      const oneByte = new co2({ model: "1byte" });
      const result = oneByte.perByteTrace(item, greenHosting, options);
      return Number(result.co2);
    } catch (err) {
      console.error("Erreur calcul CO2:", err);
      return 0;
    }
  }

  // Method to change the default grid intensity options
  changeDefaultGridIntensity(newIntensity) {
    this.gridIntensityOptionsDefault = newIntensity;
  }
}
