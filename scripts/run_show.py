from sys import argv
from time import monotonic, sleep
import json
import subprocess

def run_show(file):
    with open(file, 'r') as f:
        show = json.load(f)

    cues = sorted(show['clips'], key=lambda c: c['startSec'])

    show_start = monotonic()

    for cue in cues:
        while True:
            if monotonic() - show_start < cue['startSec']:
                sleep(0.001)
                continue
     
            print(f"FIRE {cue['firework']['name']} at Device: {cue['device']} Area: {cue['area']} Cue: {cue['cue']}")
            #subprocess.run("rpitx ...")

            break


if __name__ == '__main__':
    start = monotonic()
    run_show(argv[1])
