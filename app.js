const path = require("path");
const fs = require("fs");

const anvil = require('node-anvil');
const FourColorTheoremSolver = require("./lib/map-color-finder");

console.info("Valetudo-Minecraft-Mapper");

if(process.argv.length !== 4) {
    console.info("\n");
    console.info("Usage: node app.js /path/to/map.json /minecraft/world/output/folder\n\n");
    process.exit(0);
}

let mapData;

try {
    mapData = require(process.argv[2]);
} catch(e) {
    console.error("Error while opening map file");
    process.exit(-1);
}
if(!mapData.__class === "ValetudoMap") {
    console.error("Invalid Map File");
    process.exit(-1);
}

if (mapData.metaData?.version === 2 && Array.isArray(mapData.layers)) {
    mapData.layers.forEach(layer => {
        if(layer.pixels.length === 0 && layer.compressedPixels.length !== 0) {
            for (let i = 0; i < layer.compressedPixels.length; i = i + 3) {
                const xStart = layer.compressedPixels[i];
                const y = layer.compressedPixels[i+1]
                const count = layer.compressedPixels[i+2]

                for(let j = 0; j < count; j++) {
                    layer.pixels.push(
                        xStart + j,
                        y
                    );
                }
            }
        }
    })
}


console.info("Using Map File " + process.argv[2]);

const outputPath = path.join(path.resolve(process.argv[3]), "ValetudoMapRender");
const regionPath = path.join(outputPath, "region");

console.log("Minecraft World Output Path: " + outputPath);

console.info("Preparing World");
console.time("prepareWorld");
fs.mkdirSync(outputPath, {recursive: true });
fs.mkdirSync(regionPath, {recursive: true});
fs.copyFileSync(path.join(__dirname, "./res/template/icon.png"), path.join(outputPath, "icon.png"));
fs.copyFileSync(path.join(__dirname, "./res/template/level.dat"), path.join(outputPath, "level.dat"));
console.timeEnd("prepareWorld");

const BLOCKS = {
    AIR: new anvil.Block("minecraft", "air"),
    DIRT: new anvil.Block("minecraft", "dirt"),
    STONE: new anvil.Block("minecraft", "stone"),
    BEDROCK: new anvil.Block("minecraft", "bedrock"),
    BLUE_WOOL: new anvil.Block("minecraft", "blue_wool"),
    COLORS: [
        new anvil.Block("minecraft", "light_blue_wool"),
        new anvil.Block("minecraft", "lime_wool"),
        new anvil.Block("minecraft", "orange_wool"),
        new anvil.Block("minecraft", "yellow_wool"),
        new anvil.Block("minecraft", "purple_wool"),
    ]
}


const regionsRequired = {
    x: Math.ceil(Math.ceil(mapData.size.x / mapData.pixelSize)/512),
    y: Math.ceil(Math.ceil(mapData.size.y / mapData.pixelSize)/512)
};

const regions = [];

console.info("Preparing the regions");
console.time("prepareRegions");
for(let i = 0; i < regionsRequired.x; i++) {
    regions[i] = [];

    for(let j = 0; j < regionsRequired.y; j++) {
        regions[i][j] = new anvil.Region(i, j);

        regions[i][j].fill(BLOCKS.AIR, i*512, 0, j*512, ((i+1)*512)-1 , 96,  ((j+1)*512)-1);
        regions[i][j].fill(BLOCKS.BEDROCK, i*512, 0, j*512, ((i+1)*512)-1 , 1,  ((j+1)*512)-1);
    }
}
console.timeEnd("prepareRegions");


console.info("Calculating colors");
console.time("colorCalculation");
const colorFinder = new FourColorTheoremSolver(mapData.layers, 6);
console.timeEnd("colorCalculation");



console.info("Drawing Map");
console.time("drawMap");
mapData.layers.forEach(layer => {

    for(let i = 0; i < layer.pixels.length ; i = i+2) {
        const x = layer.pixels[i];
        const y = layer.pixels[i+1];

        const regionX = Math.floor(x / 512);
        const regionY = Math.floor(y / 512);

        switch(layer.type) {
            case "floor":
                regions[regionX][regionY].setBlock(BLOCKS.BLUE_WOOL, x, 1, y);
                break;
            case "segment":
                regions[regionX][regionY].setBlock(BLOCKS.COLORS[colorFinder.getColor((layer.metaData.segmentId))], x, 1, y);
                break;
            case "wall":
                regions[regionX][regionY].setBlock(BLOCKS.STONE, x, 1, y);
                regions[regionX][regionY].setBlock(BLOCKS.STONE, x, 2, y);
                regions[regionX][regionY].setBlock(BLOCKS.STONE, x, 3, y);
                regions[regionX][regionY].setBlock(BLOCKS.STONE, x, 4, y);
                break;
        }
    }
});
console.timeEnd("drawMap");

//Processing

console.info("Saving regions");
console.time("saveRegions");
regions.forEach((foo, i) => {
    foo.forEach((bar, j) => {
        bar.save(path.join(regionPath, 'r.'+i+'.'+j+'.mca'));
    })
})
console.timeEnd("saveRegions");

console.info("\n");
console.info("Rendered sucessfully");
console.info("Your minecraft world can be found at "+ outputPath);
