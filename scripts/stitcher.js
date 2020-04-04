console.log("Starting stitcher");
const path = require("path");
const fs = require("fs");
const util = require("util");
const PNG = require("pngjs").PNG;
const chalk = require('chalk');
// Let's start by building a tree of all the assets in the assets folder
const ASSET_DIRECTORY = path.join(__dirname, "../assets/sprites");
const MAX_WIDTH = 64;
const URL_ROOT = "https://thunderducky.github.io/pixelCaravanCDN/assets/sprites/"
// Our strategy is to place as many in a row as we can, we'll try and fit
// all the same height ones together
const [_, nanosecondStart] = process.hrtime()
const readdir = util.promisify(fs.readdir);
const readfile = util.promisify(fs.readFile);
async function main() {
    const files = await readdir(ASSET_DIRECTORY);
    const filesData = await Promise.all(
        files.map(file => srcImageFromFile(path.join(ASSET_DIRECTORY, file)))
    );
    // calculate and append the offset
    let currentX = 0;
    let currentY = 0;
    let sheetWidth = 0;
    let sheetHeight = filesData[0].height;;
    filesData.forEach(data => {
        // bounds check, if over x, adjust to newline
        if (currentX + data.width > MAX_WIDTH) {
            currentX = 0;
            currentY += data.height;
            sheetHeight += data.height;
            sheetWidth = MAX_WIDTH;
        } else if (sheetWidth < MAX_WIDTH) {
            sheetWidth += data.width;
        }
        data.x = currentX;
        data.y = currentY;
        currentX += data.width;
    })
    const outputPng = new PNG({ width: sheetWidth, height: sheetHeight, });
    let offset = "";
    const imageMapJson = {};
    filesData.forEach((image) => {
        const { path, width, height, x, y, singleURL } = image;
        imageMapJson[extractNameFromPath(path)] = {
            width,
            height,
            singleURL,
            x,
            y
        };
        embedImage(image, outputPng, x, y);

    })

    const spirteSheetDestination = path.join(__dirname, '../assets/spritesheet.png');
    outputPng.pack().pipe(fs.createWriteStream(spirteSheetDestination)).on('finish', () => {
        console.log("PNG written to ", chalk.green(spirteSheetDestination));
        console.log("Dimensions " + chalk.blue(sheetWidth + "x" + sheetHeight));
        const jsonDestination = path.join(__dirname, "../assets/spriteAtlas.json");
        fs.writeFile(jsonDestination, JSON.stringify(imageMapJson, null, 2), (err) => {
            if (err) {
                console.log(chalk.red("ERROR"), err);
            } else {
                console.log("JSON written to", chalk.green(jsonDestination));
                const [_, nanosecondEnd] = process.hrtime()
                console.log(`Stitched together ${chalk.green(files.length + " images")} in ${chalk.yellow((nanosecondEnd - nanosecondStart)/1000000)} milliseconds`)
            }
        });
    })


}
function extractNameFromPath(path) {
    const fileName = path.split('/').pop().split(".");
    fileName.pop();
    return fileName.join("").split("-").shift();
}
const ROOT = "";
function srcImageFromFile(filepath) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filepath).pipe(new PNG()).on("parsed", function () {
            resolve({
                path: filepath,
                singleURL: URL_ROOT + filepath.split("/").pop(),
                width: this.width,
                height: this.height,
                depth: this.depth,
                data: this.data
            });
        }).on("error", function (err) {
            reject(err)
        });
    });
}
function embedImage(srcImage, destImage, destOffsetX, destOffsetY) {
    for (let y = 0; y < srcImage.width; y++) {
        for (let x = 0; x < srcImage.height; x++) {
            const srcIndex = (srcImage.width * y + x) << 2;
            const destIndex = (destImage.width * (y + destOffsetY) + (x + destOffsetX)) << 2;
            destImage.data[destIndex] = srcImage.data[srcIndex];
            destImage.data[destIndex + 1] = srcImage.data[srcIndex + 1];
            destImage.data[destIndex + 2] = srcImage.data[srcIndex + 2];
            destImage.data[destIndex + 3] = srcImage.data[srcIndex + 3];
        }
    }
}
main();