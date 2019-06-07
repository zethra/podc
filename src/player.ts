import * as progressBar from 'cli-progress';

export function playEpisode (file: string) {
    const load = require('audio-loader');
    const play = require('../audio-play');
    const keypress = require('keypress');

    load(file).then((audioBuffer) => {
        let playing = true;
        const player = play(audioBuffer, {
            start: 0,
            end: audioBuffer.duration,
            loop: false,
            rate: 1,
            detune: 0,
            volume: 1,
            context: require('audio-context'),
            autoplay: true
        });
        keypress(process.stdin);

        process.stdin.on('keypress', (str, key) => {
            if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
                process.exit();
            } else if (key.name === 'space') {
                if (playing) {
                    player.pause();
                } else {
                    player.play();
                }
                playing = !playing;
            }
        });
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
        } else {
            console.error('Terminal doesn\'t support raw mode');
        }
        process.stdin.resume();

        const bar = new progressBar.Bar({
            format: '{bar} {percentage}%',
            fps: 10
        }, progressBar.Presets.shades_classic);
        bar.start(audioBuffer.duration, 0);

        setInterval(() => {
            bar.update(player.currentTime);
        }, 1000);
    });

}
