import { Co2Component } from '../src/functions_test.js';

const co2Component = new Co2Component();

window.addEventListener("load", async () => {
    console.log("Page loaded");
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