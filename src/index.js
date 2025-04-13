let map;
let geoJsonLayer;
let electionData = {};
const Chart = document.getElementById("chart");
const partyChartContainer=document.getElementById("partyChart")

const infoName = document.getElementById("info-name");
const noInfo = document.getElementById("no-info");
const partyButton = document.getElementById("party-button");
const genderButton = document.getElementById("gender-button");


const savePartyChartButton = document.getElementById("savePartyChartButton");

const savePNG = (ChartContainer, filename) => {
    html2canvas(ChartContainer).then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = imgData;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
};

savePartyChartButton.addEventListener("click", (event) => {
    event.preventDefault();
    const filename = "municipal_election_party_support_chart.png";
    savePNG(partyChartContainer, filename);
});

const partyNamesAndColors = {
    "02": { name: "KOK", color: "#000080" },
    "04": { name: "SDP", color: "#FF0000" },
    "01": { name: "KESK", color: "#008000" },
    "03": { name: "PS", color: "#00FFFF" },
    "05": { name: "VIHR", color: "#00FF00" },
    "06": { name: "VAS", color: "#800000" },
    "07": { name: "RKP", color: "#e2dc2a" },
    "08": { name: "KD", color: "#800080" }
};

async function fetchGeoData() {
    const url = "https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=tilastointialueet:kunta4500k&outputFormat=json&srsName=EPSG:4326";
    const response = await fetch(url);
    const geoData = await response.json();
    return geoData;
}

async function fetchElectionData(queryPayload) {
    const url = "https://statfin.stat.fi/PxWeb/api/v1/fi/StatFin/kvaa/statfin_kvaa_pxt_12xz.px";

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryPayload)
    });
    const data = await response.json();
    return data;
}


/*User has to choose municipality first and then they can continue to see data */

async function fetchGender() {
    if (document.getElementsByClassName("leaflet-popup-content").length > 0) { 
        noInfo.innerText = "";

        const PopupInfoText = document.getElementsByClassName("leaflet-popup-content");
        const name = PopupInfoText.item(0).innerHTML.split("<",1)[0];
        infoName.innerText = name;

        const genderUrl = "https://pxdata.stat.fi:443/PxWeb/api/v1/fi/StatFin/kvaa/statfin_kvaa_pxt_12xw.px";
        const dataPromise = await fetch(genderUrl, {
            method: "POST",
            body: JSON.stringify({
                "query": [
                    {
                        "code": "Äänioikeutetun sukupuoli",
                        "selection": {
                            "filter": "item",
                            "values": ["SSS", "1", "2"] // 1 men 2 women
                        }
                    },
                    {
                        "code": "Tiedot",
                        "selection": {
                            "filter": "item",
                            "values": ["lkm_aanest"] 
                        }
                    }
                ],
                "response": {
                    "format": "json-stat2"
                }
            })
        });

        const dataJSON = await dataPromise.json();
        const locationNames = dataJSON.dimension["Maakunta ja kunta"].category.label;
        const locationIndexes = dataJSON.dimension["Maakunta ja kunta"].category.index;

        /* By using indexes we can search for right area and find 
        how many men and women voted in each area */

        let nameIndex=-1;
        for (const property in locationNames) {
            if (locationNames[property].includes(name) == true) {
                nameIndex = locationIndexes[property];
                break;
            }
        }
  
        const maleVotes = dataJSON.value[nameIndex * 3]; // 1 men votings
        const femaleVotes = dataJSON.value[nameIndex * 3 + 1]; // 2 women votings
        const totalVotes = maleVotes+femaleVotes; // total votes

   
        const data = {
            labels: ["Men", "Women", "Total"],
            datasets: [
                {
                    type: "bar",
                    values: [maleVotes, femaleVotes, totalVotes]
                }
            ]
        };

        const chart = new frappe.Chart(Chart, {  
            title: "Gender distribution of voters",
            data: data,
            type: 'bar',
            height: 300,
            colors: ["#c486b7"] 
        });

    } else {
    }
}


fetchGender();


async function partyData() {
    if (document.getElementsByClassName("leaflet-popup-content").length > 0) {
        const PopupInfoText = document.getElementsByClassName("leaflet-popup-content");
        const name = PopupInfoText.item(0).innerHTML.split("<", 1) [0];
        //console.log("Name is: ", name);
        infoName.innerText=name;
        const queryPayload = {
            "query": [
                {
                        "code": "Puolue",
                        "selection": {
                            "filter": "item",
                            "values": [
                                "03", "01", "04", "02", "05", "06", "07", "08", "09", "21", "14",
                                "11", "20", "12", "16", "10", "19", "17", "13", "99"
                            ]
                        }
                    },
                    {
                        "code": "Tiedot",
                        "selection": {
                            "filter": "item",
                            "values": ["osuus_aanista"]
                        }
                    }
                ],
                "response": {
                    "format": "json-stat2"
                }
            };

    /*Parties need to be arranged so theyre on the right order. Next part took the most time
        as it was difficult to play around with indexes. The right area was searched using index
        and the percent of voting was searched*/
        
            const dataJSON = await fetchElectionData(queryPayload);
    
            const locationNames = dataJSON.dimension["Maakunta ja kunta"].category.label;
            const locationIndexes = dataJSON.dimension["Maakunta ja kunta"].category.index;
            const partyNamesObj = dataJSON.dimension["Puolue"].category.label;
            const partyIndex = dataJSON.dimension["Puolue"].category.index;
    
            let sortedParties = [];
            for (const property in partyNamesObj) {
                sortedParties.splice(partyIndex[property], 0, partyNamesObj[property]);
            }
            let nameIndex = -1;
            for (const property in locationNames) {
                if (locationNames[property].includes(name)) {
                    nameIndex = locationIndexes[property];
                    break;
                }
            }

            let partyPercentList = [];
            for (let i = 0; i < 11; i++) {
                partyPercentList.push(dataJSON.value[nameIndex*20+i]);
                //console.log(nameIndex);
            }
            let PartyOthers = 0;
            for (let i = 11; i < 20; i++) {
                PartyOthers += dataJSON.value[nameIndex*20+i];
            }
            partyPercentList.push(PartyOthers.toFixed(1));
            sortedParties.splice(11, 9);
            sortedParties.push("Others: ");
    
            const data = {
                labels: sortedParties,
                datasets: [
                    {
                        type: "bar",
                        values: partyPercentList
    
                    }
                ]
            };
            //const colors = Object.values(partyNamesAndColors).map(party => party.color);
            //console.log(colors);
    
    
            const chart = new frappe.Chart(partyChartContainer, {
                title: "Voting percent",
                data: data,
                type: 'bar',
                height: 300,
                colors:["#b893b0"]
            });


        } else {
        }
    }


async function initMap(geoData) {
    if (map) {
        map.remove();
    }

    map = L.map('map', {}).setView([65, 25], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(map);

    geoJsonLayer = L.geoJSON(geoData, {
        onEachFeature: onEachFeature,
        style: {
            weight: 2,
            color: "#995d89"
        }
    }).addTo(map);

    map.fitBounds(geoJsonLayer.getBounds());
}

function onEachFeature(feature, layer) {
    let kuntaID = feature.properties.kunta;
    //console.log(kuntaID);
    const electionInfo = electionData[kuntaID] || { largestParty: "99" }; // Oletuksena "Muut puolueet"
    const partyInfo = partyNamesAndColors[electionInfo.largestParty] || { name: "", color: "#cccccc" };
    const popupContent = `${feature.properties.name}<br> ${partyInfo.name}<br>KuntaID: ${kuntaID}`;
    layer.bindPopup(popupContent);
    layer.bindTooltip(feature.properties.name);
}

partyButton.addEventListener("click", partyData);
genderButton.addEventListener("click", fetchGender);

fetchGeoData().then(initMap);
