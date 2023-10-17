import puppeteer, { KeyInput } from "puppeteer";

if (!process.env.URL) {
  throw new Error("URL not defined");
}

console.log("URL ", process.env.URL);
console.log("Player Count ", process.env.PLAYER_COUNT);
console.log("Movements ", process.env.MOVEMENTS);
console.log("Movement Time", process.env.MOVEMENT_TIME);

const PLAYER_COUNT = (process.env.PLAYER_COUNT as unknown as number) || 1;
const MOVEMENTS = (process.env.MOVEMENTS as unknown as number) || 3;
const MOVEMENT_TIME = (process.env.MOVEMENT_TIME as unknown as number) || 5000;

const GRAPHQL_ENDPOINT = "/graphql";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRandomKey(): KeyInput {
  const keys = ["w", "a", "s", "d"];
  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex] as KeyInput;
}

function calculateDurations(requestDurations: Record<string, number>) {
  const durations = Object.values(requestDurations);
  if (durations.length > 0) {
    const totalDuration = durations.reduce(
      (acc, duration) => acc + duration,
      0
    );
    const averageDuration = totalDuration / durations.length;
    console.log(`Average request duration: ${averageDuration} ms`);
  } else {
    console.log("No requests were intercepted.");
  }
}

async function getBrowser() {
  return await puppeteer.launch({ headless: false });
}

async function spawnPlayer(playerId: number) {
  console.log(`spawning player ${playerId}`);

  try {
    const browser = await getBrowser();

    const page = await browser.newPage();
    await page.setJavaScriptEnabled(true);
    await page.setRequestInterception(true);

    const requestStartTimes: Record<string, number> = {};
    const requestDurations: Record<string, number> = {};

    page.on("request", (request) => {
      if (request.url().includes(GRAPHQL_ENDPOINT)) {
        const requestKey = `${request.url()}|${JSON.stringify(
          request.postData()
        )}`;
        requestStartTimes[requestKey] = Date.now();
      }

      request.continue();
    });

    page.on("response", (response) => {
      const requestKey = `${response.url()}|${JSON.stringify(
        response.request().postData()
      )}`;
      if (
        response.url().includes(GRAPHQL_ENDPOINT) &&
        requestKey in requestStartTimes
      ) {
        const startTime = requestStartTimes[requestKey];
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;
        requestDurations[requestKey] = elapsedTime;
      }
    });

    await sleep(3000);

    const websiteURL = process.env.URL as string;
    await page.goto(websiteURL);

    await sleep(30000);
    console.log("finished waiting for startup");
    // await page.screenshot({
    //   path: `./screenshots/first_load_${playerId}.png`,
    //   type: "png",
    // });

    for (let i = 0; i < 3; i++) {
      await page.mouse.click(300, 30);
      await sleep(1000);
    }

    for (let i = 0; i < MOVEMENTS; i++) {
      const keyToUse = getRandomKey();
      await page.keyboard.down(keyToUse);
      await sleep(MOVEMENT_TIME);
      await page.keyboard.up(keyToUse);
    }

    // await page.screenshot({
    //   path: `./screenshots/before_close_${playerId}.png`,
    //   type: "png",
    // });

    calculateDurations(requestDurations);

    await browser.close();
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function main() {
  let promises = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    promises.push(spawnPlayer(i));
  }
  await Promise.all(promises);
}

main();
