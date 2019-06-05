import * as argparse from 'command-line-args';
import * as Parser from 'rss-parser';
import * as readline from 'readline';
import * as request from 'request';
import * as fs from 'fs';
import * as progressBar from 'cli-progress';

class AppConfig {
    verbose: boolean;

    constructor() {
        this.verbose = false;
    }
}

let APP = new AppConfig();
let HELP = `node_demo

a demo node cli application`;

function main() {
    // Parse cli args
    const cliOpts = [
        { name: 'verbose', alias: 'v', type: Boolean },
        { name: 'help', alias: 'h', type: Boolean },
        { name: 'feed_url', type: String, defaultOption: true }
    ];
    const args = argparse(cliOpts);
    console.log(args);

    // Print help and exit if help cli flag is present
    if (args.help) {
        console.log(HELP);
        return;
    }

    // Set verbose flag in app config
    if (args.verbose) {
        APP.verbose = true;
    }

    console.log(APP);

    let parser = new Parser();

    if (!args.feed_url) {
        console.log(HELP);
        return;
    }

    parser.parseURL(args.feed_url).then((feed) => {
        console.log(`${feed.title}\n${feed.description}\n\n`);
        if (feed.items) {
            for (const i in feed.items) {
                const item = feed.items[i];
                console.log(`[${i}] ${item.title}`);
            }

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question('\nSelect episode: ', (answer) => {
                console.log(answer);
                const episodeIdx = parseInt(answer, 10);
                rl.close();

                if (feed.items === undefined) {
                    console.log('Feed was empty');
                    return;
                }

                const episode = feed.items[episodeIdx];
                console.log(episode.enclosure);
                let title;
                if (episode.title) {
                    title = episode.title;
                } else {
                    title = 'Episode';
                }
                downloadEpisode(`${title}.mp3`, episode.enclosure.url, episode.enclosure.length);
            });

        }
    });
}

function downloadEpisode(name: string, url: string, size: number) {
    const progress = require('request-progress');
    const bar = new progressBar.Bar({
        format: 'download {bar} {percentage}% | ETA: {eta}s',
        fps: 10
    }, progressBar.Presets.shades_classic);
    bar.start(100, 0);
    progress(request(url), {})
        .on('progress', (state) => {
            bar.update(Math.round(state.percent * 100));
            // console.log('progress', state);
        })
        .on('error', (err) => {
            console.log(err);
        })
        .on('end', () => {
            bar.update(100);
            bar.stop();
        })
        .pipe(fs.createWriteStream(name));
}

// function vlog(...args: [String]) {
//     if (APP.verbose) {
//         console.log(...args);
//     }
// }

main();
