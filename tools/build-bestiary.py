#!/usr/bin/env python3
"""Crea js/bestiary.js: i mostri più usati nelle prime avventure con la loro icona.

Le icone vengono da game-icons.net (licenza CC BY 3.0, autore indicato per ognuna).
Uso (dalla cartella del progetto):
    git clone --depth 1 https://github.com/game-icons/icons /tmp/game-icons
    python3 tools/build-bestiary.py /tmp/game-icons js/bestiary.js
"""
import json, re, sys, os

SRC = sys.argv[1] if len(sys.argv) > 1 else 'game-icons'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'js/bestiary.js'
SRD = {m['i']: m for m in json.load(open(os.path.join(os.path.dirname(OUT), '..', 'data', 'srd-monsters.json'), encoding='utf-8'))}

AUTHORS = {'lorc': 'Lorc', 'delapouite': 'Delapouite', 'carl-olsen': 'Carl Olsen', 'caro-asercion': 'Caro Asercion',
           'darkzaitzev': 'DarkZaitzev', 'skoll': 'Skoll', 'sparker': 'Sparker'}

# (gruppo, indice SRD, icona)
COMMON = [
    ('Umanoidi', 150, 'delapouite/goblin-head'), ('Umanoidi', 169, 'carl-olsen/brutal-helm'),
    ('Umanoidi', 57, 'delapouite/brute'), ('Umanoidi', 183, 'lorc/evil-minion'),
    ('Umanoidi', 216, 'delapouite/orc-head'), ('Umanoidi', 148, 'caro-asercion/hyena-head'),
    ('Umanoidi', 190, 'lorc/lizardman'), ('Umanoidi', 247, 'delapouite/fish-monster'),
    ('Umanoidi', 38, 'delapouite/bandit'), ('Umanoidi', 39, 'delapouite/pirate-captain'),
    ('Umanoidi', 78, 'lorc/cultist'), ('Umanoidi', 77, 'darkzaitzev/hooded-figure'),
    ('Umanoidi', 159, 'lorc/visored-helm'), ('Umanoidi', 283, 'lorc/dripping-blade'),
    ('Umanoidi', 2, 'delapouite/sun-priest'),
    ('Non morti', 259, 'skoll/skeleton'), ('Non morti', 325, 'delapouite/shambling-zombie'),
    ('Non morti', 115, 'skoll/raise-zombie'), ('Non morti', 254, 'lorc/shadow-follower'),
    ('Non morti', 261, 'lorc/spectre'), ('Non morti', 307, 'lorc/crowned-skull'),
    ('Non morti', 205, 'delapouite/mummy-head'),
    ('Bestie', 310, 'lorc/wolf-head'), ('Bestie', 84, 'lorc/direwolf'), ('Bestie', 311, 'lorc/wolf-howl'),
    ('Bestie', 139, 'carl-olsen/spider-alt'), ('Bestie', 134, 'delapouite/rat'), ('Bestie', 278, 'lorc/seated-mouse'),
    ('Bestie', 118, 'delapouite/bat'), ('Bestie', 56, 'sparker/bear-face'), ('Bestie', 52, 'caro-asercion/boar'),
    ('Bestie', 133, 'lorc/snake'), ('Bestie', 267, 'lorc/evil-bat'),
    ('Mostri', 219, 'caro-asercion/barn-owl'), ('Mostri', 213, 'delapouite/ogre'), ('Mostri', 163, 'lorc/harpy'),
    ('Mostri', 201, 'delapouite/mimic-chest'), ('Mostri', 153, 'delapouite/slime'), ('Mostri', 112, 'delapouite/cube'),
    ('Mostri', 111, 'delapouite/gargoyle'), ('Mostri', 177, 'lorc/imp'), ('Mostri', 26, 'delapouite/black-knight-helm'),
    ('Mostri', 306, 'lorc/dragon-head'), ('Mostri', 202, 'lorc/minotaur'),
]

entries = []
for group, srd, icon in COMMON:
    svg = open(os.path.join(SRC, icon + '.svg'), encoding='utf-8').read()
    paths = re.findall(r'<path[^>]*\sd="([^"]+)"', svg)
    d = [p for p in paths if p != 'M0 0h512v512H0z']
    assert len(d) == 1, icon
    author = AUTHORS[icon.split('/')[0]]
    m = SRD[srd]
    entries.append({'g': group, 'i': srd, 'n': m['n'], 'cr': m['cr'], 'a': author, 'd': d[0]})

body = ',\n'.join('  ' + json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in entries)
js = f"""// Mostri più usati nelle prime avventure, con un'icona pronta per la pedina.
// File generato da tools/build-bestiary.py: non modificarlo a mano.
// Icone da game-icons.net, licenza CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/):
// autore indicato in "a" per ogni mostro.
const COMMON_MONSTERS = [
{body}
];
"""
open(OUT, 'w', encoding='utf-8').write(js)
print(len(entries), 'mostri,', len(js), 'byte')
