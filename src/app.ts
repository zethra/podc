import * as argparse from 'command-line-args';
import * as Parser from 'rss-parser';
import * as request from 'request';
import * as fs from 'fs';
import * as progressBar from 'cli-progress';
import * as inquirer from 'inquirer';
import * as commandLineUsage from 'command-line-usage';

class AppConfig {
    public verbose: boolean;

    constructor() {
        this.verbose = false;
    }
}

const APP = new AppConfig();

function main() {
    // Parse cli args
    const cliOpts = [
        { name: 'verbose', alias: 'v', type: Boolean },
        { name: 'help', alias: 'h', type: Boolean },
        { name: 'feed_url', type: String, defaultOption: true },
    ];
    const args = argparse(cliOpts);

    // Print help and exit if help cli flag is present
    if (args.help) {
        help();
        return;
    }

    // Set verbose flag in app config
    if (args.verbose) {
        APP.verbose = true;
    }

    const parser = new Parser();

    if (!args.feed_url) {
        usage_and_exit();
    }

    parser.parseURL(args.feed_url).then((feed) => {
        console.log(`${feed.title}\n${feed.description}\n\n`);
        if (feed.items) {
            const items = feed.items;
            const listItems = items.map((item, idx) => {
                return {name: item.title, value: idx};
            });
            inquirer.prompt({
                choices: listItems,
                message: 'Select an episode',
                name: 'episode',
                pageSize: 30,
                type: 'list',
            }).then((answer: {episode: number}) => {
                const episodeIdx = answer.episode;

                if (feed.items === undefined) {
                    console.log('Feed was empty');
                    process.exit(2);
                    // Compiler doesn't realize this ^ exits I so I need to return?
                    return;
                }

                const episode = feed.items[episodeIdx];
                const title = episode.title ? episode.title : 'Episode';
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
        })
        .on('error', (err) => {
            console.log(err);
            process.exit(3);
        })
        .on('end', () => {
            bar.update(100);
            bar.stop();
            console.log(`File '${name}' download complete!`);
        })
        .pipe(fs.createWriteStream(name));
}

function usage_and_exit() {
    const usage = 'podc [-hv] <feed url>';
    console.log(usage);
    process.exit(1);
}

function help() {
    const sections = [
        {
            header: 'podc',
            content: 'A podcast catcher'
        },
        {
            header: 'Options',
            optionList: [
                {
                    name: 'help',
                    description: 'Print this help message'
                },
                {
                    name: 'verbose',
                    description: 'Print more details of operation (mostly for debugging)'
                }
            ]
        }
    ];
    console.log(commandLineUsage(sections));
}

function vlog(...args: [String]) {
    if (APP.verbose) {
        console.log(...args);
    }
}

main();
