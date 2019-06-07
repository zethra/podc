import * as argparse from 'command-line-args';
import * as RssParser from 'rss-parser';
import * as request from 'request';
import * as fs from 'fs';
import * as progressBar from 'cli-progress';
import * as inquirer from 'inquirer';
import * as commandLineUsage from 'command-line-usage';
import { playEpisode } from './player';

/**
 * Global application state.
 */
class AppConfig {
    public verbose: boolean;

    constructor() {
        this.verbose = false;
    }
}

const APP = new AppConfig();

/**
 * Main program.
 */
function main() {
    // Parse cli args
    const cliOpts = [
        { name: 'verbose', alias: 'v', type: Boolean },
        { name: 'help', alias: 'h', type: Boolean },
        { name: 'feed_url', type: String, defaultOption: true },
    ];
    const cliArgs = argparse(cliOpts);

    // Print help and exit if help cli flag is present
    if (cliArgs.help) {
        help();
        return;
    }

    // Set verbose flag in app config
    if (cliArgs.verbose) {
        APP.verbose = true;
        console.log('Verbose mode active');
    }

    // Error out if the feed url is missing
    if (!cliArgs.feed_url) {
        usage_and_exit();
    }

    // Download and parse the rss feed from the url
    const rssParser = new RssParser();
    vlog(`Downloading rss feed from: \`${cliArgs.feed_url}\``);
    rssParser.parseURL(cliArgs.feed_url).then((feed) => {
        // Print the title and description
        console.log(`${feed.title}\n${feed.description}\n\n`);

        // If the feed is empty exit
        if (!feed.items) {
            console.log('Feed is empty');
            return;
        }

        // Map episode title to tiles and indexes so we can
        // get the index back later and avoid searching
        // the list of titles
        const items = feed.items;
        const listItems = items.map((item, idx) => {
            return {name: item.title, value: idx};
        });
        // Ask the user to select the episode they want to download
        inquirer.prompt({
            choices: listItems,
            message: 'Select an episode',
            name: 'episode',
            pageSize: 30,
            type: 'list',
        }).then((answer: {episode: number}) => {
            vlog(`Selected item: ${answer}`);
            // Get the index of the selected episode
            const episodeIdx = answer.episode;

            // If the feed is empty we shouldn't have gotten here
            // but the compiler doesn't know that so if we have some how error out
            if (feed.items === undefined) {
                console.log('Feed was empty');
                process.exit(2);
                // Compiler doesn't realize this ^ exits I so I need to return?
                return;
            }

            // Grab the rss feed data for the selected episode
            const episode = feed.items[episodeIdx];
            // Download the episode
            const title = episode.title ? episode.title : 'Episode';
            // Grab file extension form the url
            const fileExt = episode.enclosure.url.split('.').pop();
            downloadEpisode(`${title}.${fileExt}`, episode.enclosure.url, episode.enclosure.length);
        });
    });
}

/**
 * Download an episode
 * @param name name of the file to download to.
 * @param url the url of the file to download.
 * @param size the size of the file being downloaded
 */
function downloadEpisode(name: string, url: string, size: number) {
    // request-progress doesn't have types some I'm importing it this way
    const progress = require('request-progress');
    // Construct the progress bar object
    const bar = new progressBar.Bar({
        format: 'download {bar} {percentage}% | ETA: {eta}s',
        fps: 10
    }, progressBar.Presets.shades_classic);
    // Bar goes from 0 to 100 and starts at 0
    bar.start(100, 0);
    // Made an http request and monitor it's progress
    progress(request(url), {})
        .on('progress', (state) => {
            // When download progress is reported update the bar's
            // position with the download's percent completion
            bar.update(Math.round(state.percent * 100));
        })
        .on('error', (err) => {
            console.log(err);
            process.exit(3);
        })
        .on('end', () => {
            // Set the barr to 100 once the download is completed
            // because the progress handler never reports 100%
            // completion and the bar should be at 100% when the download
            // is complete
            bar.update(100);
            // Stop the bar so it releases the terminal
            bar.stop();
            console.log(`File '${name}' download complete!`);
            console.log('Playing...');
            playEpisode(name);
        })
        // Save the file to the name provided
        .pipe(fs.createWriteStream(name));
}

/**
 * Print the usage message and exit with an error.
 */
function usage_and_exit() {
    const usage = 'podc [-hv] <feed url>';
    console.log(usage);
    process.exit(1);
}

/**
 * Print the help message
 */
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

/**
 * Print this if in verbose mode.
 * @param args things to print.
 */
function vlog(...args: [String]) {
    if (APP.verbose) {
        console.log('[DEBUG]', ...args);
    }
}

main();
