# co2-of-front
This library is a use of @tgwf/co2 to mesure the co2 produced by a webpage, directly in the web page.
It checks every ressource of the page, and depending on the weight and the domain, determine the co2 produced by it.
It also uses some of the greenweb foundation APIs to determine if the server hosting the ressource is green, and what is his gCO2/kWh if its listed.


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

### Analyse over time

This time, you will need to initialise the component as
```javascript
co2Component = new ExtendedCo2Component();
```

For the update to work, a call to 
```javascript
co2Component.doCheck()
```

need to be done every X time, for example in angular, 
```typescript
ngDoCheck() {
    this.co2Component.doCheck();
}
```
