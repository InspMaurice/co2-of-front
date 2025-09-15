# co2-of-front
This library is a use of @tgwf/co2 to mesure the co2 produced by a webpage, directly in the web page.
It checks every ressource of the page, and depending on the weight and the domain, determine the co2 produced by it.
It also uses some of the greenweb foundation APIs to determine if the server hosting the ressource is green, and what is his gCO2/kWh if its listed.
(this is still just a test done by a intern)


## Installation
### Using NPM
You can install co2-of-front for web projects using NPM :
```bash
npm install co2-of-front
```

## Functionning

You have two option to use this library. 
The first one will give you only the weight and co2 production at the end of the loading of the page.
The second one will allow you to have metrics that update everytime a new ressource is loaded into the page.
This second option shouldn't be used in a website in production, as it will use more processor, then goes against green practices which is not the goal of this library.

Before using one of the component, you can (and should) change the default options of co2/kWh that will be used if values cannot be found.
You can change it by using ```changeDefaultGridIntensity(newIntensity)```, with "newIntensity" as it follows :
``` javascript
gridIntensity: {
    device: { country: "FRA" },
    dataCenter: 207,
    network: { country: "FRA" }
}
```
device and network need to be an object with the code Apha-3 ISO of the country needed, and dataCenter a number.

### One time analyse

For mesuring the weight and emissions on the load of the page, you just need to create a new component. 
```javascript
co2Component = new Co2Component();
```
It will wait for the page to be fully loaded, and then start calculing.
The first estimation only uses the total weight of the page, the second estimation, the more accurate one can be a little bit longer to finish.

In case of use in a framework like angular, the metrics car be dynamically use in the component you chose to put it in. ex :
```html
<p>Weight : {{ co2Component.emissions.weight / 1000 }} ko</p>
<p>CO₂ : {{ co2Component.emissions.co2weight }} g</p>
```

If manually getting the metrics is required, you can use 
```javascript
getCurrectCo2()
```
To time this call, you'll need to use "currentState". 
A currentState = 0 means nothing has been calculated.
A currentState = 1 means the first estimation is finished.
A currentState = 2 means the complexe estimation is finished.

Here is an example of how it could be done : 
```javascript
window.addEventListener("load", async () => {
    await checkForUpdateCo2();
});

async function checkForUpdateCo2() {
    while (co2Component.currentState == 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    updateCo2();
    while (co2Component.currentState == 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    updateCo2();

}

function updateCo2() {
    const co2temp = co2Component.getCurrentCo2();
    console.log("Current CO2:", co2temp);
    const emissionsEl = document.querySelector(".emissions");
    if (emissionsEl) {
        emissionsEl.innerHTML = `CO₂: ${co2temp.co2weight} g (Page weight: ${co2temp.weight/1000} Ko)`;
    }
}
```


### Analyse over time

This time, you will need to initialise the component as
```javascript
co2Component = new ExtendedCo2Component();
```

For the update to work, a call to 
```javascript
co2Component.doCheck()
```

You'll need to call this function every X ms, depending on your own preferences.
This is the simpliest way in angular.
```typescript
ngDoCheck() {
    this.co2Component.doCheck();
}
```
