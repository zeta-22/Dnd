#!/usr/bin/env python3
"""Crea data/srd-monsters.json e data/srd-spells.json per Il Tavolo a partire da 5e-database (SRD 5.1).
Nomi e campi in italiano, descrizioni lunghe nel testo ufficiale inglese.

Uso (dalla cartella del progetto):
    npm pack dnd5-srd@1.0.0 && mkdir -p /tmp/srd && tar -xzf dnd5-srd-1.0.0.tgz -C /tmp/srd
    python3 tools/build-srd.py /tmp/srd/package data
"""
import json, re, sys, os

SRC = sys.argv[1] if len(sys.argv) > 1 else 'srd-package'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'data'

monsters = json.load(open(os.path.join(SRC, 'monsters.json')))
spells = json.load(open(os.path.join(SRC, 'spells.json')))

# ---------------------------------------------------------------- nomi dei mostri
COLORS = {'Black': 'Nero', 'Blue': 'Blu', 'Brass': "d'Ottone", 'Bronze': 'di Bronzo', 'Copper': 'di Rame',
          'Gold': "d'Oro", 'Green': 'Verde', 'Red': 'Rosso', 'Silver': "d'Argento", 'White': 'Bianco'}
AGES = {'Adult': 'Adulto', 'Ancient': 'Antico', 'Young': 'Giovane'}
GIANT_OF = {'Ape': 'Scimmia', 'Badger': 'Tasso', 'Bat': 'Pipistrello', 'Boar': 'Cinghiale', 'Centipede': 'Millepiedi',
            'Constrictor Snake': 'Serpente Costrittore', 'Crab': 'Granchio', 'Crocodile': 'Coccodrillo', 'Eagle': 'Aquila',
            'Elk': 'Alce', 'Fire Beetle': 'Scarabeo di Fuoco', 'Frog': 'Rana', 'Goat': 'Capra', 'Hyena': 'Iena',
            'Lizard': 'Lucertola', 'Octopus': 'Piovra', 'Owl': 'Gufo', 'Poisonous Snake': 'Serpente Velenoso', 'Rat': 'Ratto',
            'Rat (Diseased)': 'Ratto (Infetto)', 'Scorpion': 'Scorpione', 'Sea Horse': 'Cavalluccio Marino', 'Shark': 'Squalo',
            'Spider': 'Ragno', 'Toad': 'Rospo', 'Vulture': 'Avvoltoio', 'Wasp': 'Vespa', 'Weasel': 'Donnola', 'Wolf Spider': 'Ragno Lupo'}
SWARM_OF = {'Bats': 'Pipistrelli', 'Beetles': 'Scarabei', 'Centipedes': 'Millepiedi', 'Insects': 'Insetti',
            'Poisonous Snakes': 'Serpenti Velenosi', 'Quippers': 'Quipper', 'Rats': 'Ratti', 'Ravens': 'Corvi',
            'Spiders': 'Ragni', 'Wasps': 'Vespe'}
MONSTER_NAMES = {
    'Aboleth': 'Aboleth', 'Acolyte': 'Accolito', 'Adult Blue Dracolich': 'Dracolich Blu Adulto', 'Air Elemental': "Elementale dell'Aria",
    'Androsphinx': 'Androsfinge', 'Animated Armor': 'Armatura Animata', 'Ankheg': 'Ankheg', 'Ape': 'Scimmia', 'Archmage': 'Arcimago',
    'Assassin': 'Assassino', 'Awakened Shrub': 'Arbusto Risvegliato', 'Awakened Tree': 'Albero Risvegliato', 'Axe Beak': "Becco d'Ascia",
    'Azer': 'Azer', 'Baboon': 'Babbuino', 'Badger': 'Tasso', 'Balor': 'Balor', 'Bandit': 'Bandito', 'Bandit Captain': 'Capitano dei Banditi',
    'Barbed Devil': 'Diavolo Uncinato', 'Basilisk': 'Basilisco', 'Bat': 'Pipistrello', 'Bearded Devil': 'Diavolo Barbuto', 'Behir': 'Behir',
    'Berserker': 'Berserker', 'Black Bear': 'Orso Nero', 'Black Pudding': 'Budino Nero', 'Blink Dog': 'Cane Intermittente',
    'Blood Hawk': 'Falco Sanguinario', 'Boar': 'Cinghiale', 'Bone Devil': 'Diavolo delle Ossa', 'Brown Bear': 'Orso Bruno',
    'Bugbear': 'Bugbear', 'Bulette': 'Bulette', 'Camel': 'Cammello', 'Carrion Crawler': 'Strisciante Carnivoro', 'Cat': 'Gatto',
    'Cave Bear': 'Orso delle Caverne', 'Centaur': 'Centauro', 'Chain Devil': 'Diavolo delle Catene', 'Chimera': 'Chimera', 'Chuul': 'Chuul',
    'Clay Golem': "Golem d'Argilla", 'Cloaker': 'Cloaker', 'Cloud Giant': 'Gigante delle Nuvole', 'Cockatrice': 'Cocatrice',
    'Commoner': 'Popolano', 'Constrictor Snake': 'Serpente Costrittore', 'Couatl': 'Couatl', 'Crab': 'Granchio', 'Crocodile': 'Coccodrillo',
    'Cult Fanatic': 'Fanatico del Culto', 'Cultist': 'Cultista', 'Darkmantle': 'Mantoscuro', 'Death Dog': 'Cane della Morte',
    'Deep Gnome (Svirfneblin)': 'Gnomo delle Profondità (Svirfneblin)', 'Deer': 'Cervo', 'Deva': 'Deva', 'Dire Wolf': 'Lupo Crudele',
    'Djinni': 'Djinni', 'Doppelganger': 'Doppelganger', 'Draft Horse': 'Cavallo da Tiro', 'Dragon Turtle': 'Tartaruga Drago',
    'Dretch': 'Dretch', 'Drider': 'Drider', 'Drow': 'Drow', 'Druid': 'Druido', 'Dryad': 'Driade', 'Duergar': 'Duergar',
    'Dust Mephit': 'Mefite della Polvere', 'Eagle': 'Aquila', 'Earth Elemental': 'Elementale della Terra', 'Efreeti': 'Efreeti',
    'Elephant': 'Elefante', 'Elk': 'Alce', 'Erinyes': 'Erinni', 'Ettercap': 'Ettercap', 'Ettin': 'Ettin', 'Fire Elemental': 'Elementale del Fuoco',
    'Fire Giant': 'Gigante del Fuoco', 'Flesh Golem': 'Golem di Carne', 'Flying Snake': 'Serpente Volante', 'Flying Sword': 'Spada Volante',
    'Frog': 'Rana', 'Frost Giant': 'Gigante del Gelo', 'Gargoyle': 'Gargoyle', 'Gelatinous Cube': 'Cubo Gelatinoso', 'Ghast': 'Ghast',
    'Ghost': 'Fantasma', 'Ghoul': 'Ghoul', 'Gibbering Mouther': 'Bocca Gorgogliante', 'Glabrezu': 'Glabrezu', 'Gladiator': 'Gladiatore',
    'Gnoll': 'Gnoll', 'Goat': 'Capra', 'Goblin': 'Goblin', 'Gorgon': 'Gorgone', 'Gray Ooze': 'Melma Grigia', 'Green Hag': 'Megera Verde',
    'Grick': 'Grick', 'Griffon': 'Grifone', 'Grimlock': 'Grimlock', 'Guard': 'Guardia', 'Guardian Naga': 'Naga Guardiano',
    'Gynosphinx': 'Ginosfinge', 'Half-Red Dragon Veteran': 'Veterano Mezzo Drago Rosso', 'Harpy': 'Arpia', 'Hawk': 'Falco',
    'Hell Hound': 'Segugio Infernale', 'Hezrou': 'Hezrou', 'Hill Giant': 'Gigante delle Colline', 'Hippogriff': 'Ippogrifo',
    'Hobgoblin': 'Hobgoblin', 'Homunculus': 'Homunculus', 'Horned Devil': 'Diavolo Cornuto', 'Hunter Shark': 'Squalo Cacciatore',
    'Hydra': 'Idra', 'Hyena': 'Iena', 'Ice Devil': 'Diavolo del Ghiaccio', 'Ice Mephit': 'Mefite del Ghiaccio', 'Imp': 'Imp',
    'Invisible Stalker': 'Inseguitore Invisibile', 'Iron Golem': 'Golem di Ferro', 'Jackal': 'Sciacallo', 'Killer Whale': 'Orca',
    'Knight': 'Cavaliere', 'Kobold': 'Coboldo', 'Kraken': 'Kraken', 'Lamia': 'Lamia', 'Lemure': 'Lemure', 'Lich': 'Lich', 'Lion': 'Leone',
    'Lizard': 'Lucertola', 'Lizardfolk': 'Lucertoloide', 'Mage': 'Mago', 'Magma Mephit': 'Mefite del Magma', 'Magmin': 'Magmin',
    'Mammoth': 'Mammut', 'Manticore': 'Manticora', 'Marilith': 'Marilith', 'Mastiff': 'Mastino', 'Medusa': 'Medusa', 'Merfolk': 'Tritone',
    'Merrow': 'Merrow', 'Mimic': 'Mimic', 'Minotaur': 'Minotauro', 'Minotaur Skeleton': 'Scheletro di Minotauro', 'Mule': 'Mulo',
    'Mummy': 'Mummia', 'Mummy Lord': 'Signore delle Mummie', 'Nalfeshnee': 'Nalfeshnee', 'Night Hag': 'Megera Notturna',
    'Nightmare': 'Incubo (destriero)', 'Noble': 'Nobile', 'Ochre Jelly': 'Gelatina Ocra', 'Octopus': 'Polpo', 'Ogre': 'Ogre',
    'Ogre Zombie': 'Zombi Ogre', 'Oni': 'Oni', 'Orc': 'Orco', 'Otyugh': 'Otyugh', 'Owl': 'Gufo', 'Owlbear': 'Orsogufo', 'Panther': 'Pantera',
    'Pegasus': 'Pegaso', 'Phase Spider': 'Ragno Fase', 'Pit Fiend': 'Diavolo della Fossa', 'Planetar': 'Planetar',
    'Plesiosaurus': 'Plesiosauro', 'Poisonous Snake': 'Serpente Velenoso', 'Polar Bear': 'Orso Polare', 'Pony': 'Pony',
    'Priest': 'Sacerdote', 'Pseudodragon': 'Pseudodrago', 'Purple Worm': 'Verme Purpureo', 'Quasit': 'Quasit', 'Quipper': 'Quipper',
    'Rakshasa': 'Rakshasa', 'Rat': 'Ratto', 'Raven': 'Corvo', 'Reef Shark': 'Squalo della Barriera', 'Remorhaz': 'Remorhaz',
    'Rhinoceros': 'Rinoceronte', 'Riding Horse': 'Cavallo da Galoppo', 'Roc': 'Roc', 'Roper': 'Roper', 'Rug of Smothering': 'Tappeto Soffocante',
    'Rust Monster': 'Mostro della Ruggine', 'Saber-Toothed Tiger': 'Tigre dai Denti a Sciabola', 'Sahuagin': 'Sahuagin',
    'Salamander': 'Salamandra', 'Satyr': 'Satiro', 'Scorpion': 'Scorpione', 'Scout': 'Esploratore', 'Sea Hag': 'Megera Marina',
    'Sea Horse': 'Cavalluccio Marino', 'Shadow': 'Ombra', 'Shambling Mound': 'Cumulo Strisciante', 'Shield Guardian': 'Guardiano Protettore',
    'Shrieker': 'Fungo Urlante', 'Skeleton': 'Scheletro', 'Solar': 'Solar', 'Specter': 'Spettro', 'Spider': 'Ragno',
    'Spirit Naga': 'Naga Spirituale', 'Sprite': 'Spiritello', 'Spy': 'Spia', 'Steam Mephit': 'Mefite del Vapore', 'Stirge': 'Stirge',
    'Stone Giant': 'Gigante delle Pietre', 'Stone Golem': 'Golem di Pietra', 'Storm Giant': 'Gigante delle Tempeste',
    'Succubus/Incubus': 'Succube/Incubo', 'Tarrasque': 'Tarrasque', 'Thug': 'Tagliagole', 'Tiger': 'Tigre', 'Treant': 'Treant',
    'Tribal Warrior': 'Guerriero Tribale', 'Triceratops': 'Triceratopo', 'Troll': 'Troll', 'Tyrannosaurus Rex': 'Tirannosauro Rex',
    'Unicorn': 'Unicorno', 'Vampire': 'Vampiro', 'Vampire Spawn': 'Progenie Vampirica', 'Veteran': 'Veterano',
    'Violet Fungus': 'Fungo Violaceo', 'Vrock': 'Vrock', 'Vulture': 'Avvoltoio', 'Warhorse': 'Cavallo da Guerra',
    'Warhorse Skeleton': 'Scheletro di Cavallo da Guerra', 'Water Elemental': "Elementale dell'Acqua", 'Weasel': 'Donnola',
    'Werebear': 'Orso Mannaro', 'Wereboar': 'Cinghiale Mannaro', 'Wererat': 'Ratto Mannaro', 'Weretiger': 'Tigre Mannara',
    'Werewolf': 'Lupo Mannaro', 'Wight': 'Wight', "Will-o'-Wisp": 'Fuoco Fatuo', 'Winter Wolf': 'Lupo Invernale', 'Wolf': 'Lupo',
    'Worg': 'Worg', 'Wraith': 'Wraith', 'Wyvern': 'Viverna', 'Xorn': 'Xorn', 'Zombie': 'Zombi'
}

def monster_name(n):
    if n in MONSTER_NAMES: return MONSTER_NAMES[n]
    m = re.match(r'^(Adult|Ancient|Young) (\w+) Dragon$', n)
    if m: return f"Drago {COLORS[m.group(2)]} {AGES[m.group(1)]}"
    m = re.match(r'^(\w+) Dragon Wyrmling$', n)
    if m: return f"Cucciolo di Drago {COLORS[m.group(1)]}"
    if n.startswith('Giant ') and n[6:] in GIANT_OF: return f"{GIANT_OF[n[6:]]} Gigante".replace(' (Infetto) Gigante', ' Gigante (Infetto)')
    if n.startswith('Swarm of ') and n[9:] in SWARM_OF: return f"Sciame di {SWARM_OF[n[9:]]}"
    raise SystemExit(f'Nome mostro senza traduzione: {n}')

SUBTYPES = {'any race': 'qualsiasi razza', 'devil': 'diavolo', 'demon': 'demone', 'human': 'umano', 'shapechanger': 'mutaforma',
            'goblinoid': 'goblinoide', 'titan': 'titano', 'gnome': 'gnomo', 'elf': 'elfo', 'dwarf': 'nano', 'gnoll': 'gnoll',
            'grimlock': 'grimlock', 'kobold': 'coboldo', 'lizardfolk': 'lucertoloide', 'merfolk': 'tritone', 'orc': 'orco', 'sahuagin': 'sahuagin'}
SIZES = {'Tiny': 'Minuscola', 'Small': 'Piccola', 'Medium': 'Media', 'Large': 'Grande', 'Huge': 'Enorme', 'Gargantuan': 'Mastodontica'}
TYPES = {'aberration': 'aberrazione', 'beast': 'bestia', 'celestial': 'celestiale', 'construct': 'costrutto', 'dragon': 'drago',
         'elemental': 'elementale', 'fey': 'folletto', 'fiend': 'immondo', 'giant': 'gigante', 'humanoid': 'umanoide',
         'monstrosity': 'mostruosità', 'ooze': 'melma', 'plant': 'vegetale', 'undead': 'non morto', 'swarm of Tiny beasts': 'sciame di bestie Minuscole'}
ALIGN_WORDS = [('any non-good alignment', 'qualsiasi allineamento non buono'), ('any non-lawful alignment', 'qualsiasi allineamento non legale'),
               ('any chaotic alignment', 'qualsiasi allineamento caotico'), ('any evil alignment', 'qualsiasi allineamento malvagio'),
               ('any alignment', 'qualsiasi allineamento'), ('unaligned', 'senza allineamento'), ('lawful', 'legale'), ('chaotic', 'caotico'),
               ('neutral', 'neutrale'), ('good', 'buono'), ('evil', 'malvagio'), (' or ', ' o ')]
DAMAGE = {'acid': 'acido', 'bludgeoning': 'contundente', 'cold': 'freddo', 'fire': 'fuoco', 'force': 'forza', 'lightning': 'fulmine',
          'necrotic': 'necrotico', 'piercing': 'perforante', 'poison': 'veleno', 'psychic': 'psichico', 'radiant': 'radioso',
          'slashing': 'tagliente', 'thunder': 'tuono'}
CONDITIONS = {'blinded': 'accecato', 'charmed': 'affascinato', 'deafened': 'assordato', 'exhaustion': 'indebolimento',
              'frightened': 'spaventato', 'grappled': 'afferrato', 'incapacitated': 'incapacitato', 'invisible': 'invisibile',
              'paralyzed': 'paralizzato', 'petrified': 'pietrificato', 'poisoned': 'avvelenato', 'prone': 'prono',
              'restrained': 'trattenuto', 'stunned': 'stordito', 'unconscious': 'privo di sensi'}
ABIL = {'STR': 'FOR', 'DEX': 'DES', 'CON': 'COS', 'INT': 'INT', 'WIS': 'SAG', 'CHA': 'CAR'}
SKILLS = {'Acrobatics': 'Acrobazia', 'Animal Handling': 'Addestrare Animali', 'Arcana': 'Arcano', 'Athletics': 'Atletica',
          'Deception': 'Inganno', 'History': 'Storia', 'Insight': 'Intuizione', 'Intimidation': 'Intimidire', 'Investigation': 'Indagare',
          'Medicine': 'Medicina', 'Nature': 'Natura', 'Perception': 'Percezione', 'Performance': 'Intrattenere', 'Persuasion': 'Persuasione',
          'Religion': 'Religione', 'Sleight of Hand': 'Rapidità di Mano', 'Stealth': 'Furtività', 'Survival': 'Sopravvivenza'}
LANG = [('telepathy', 'telepatia'), ('Common', 'Comune'), ('Draconic', 'Draconico'), ('Elvish', 'Elfico'), ('Dwarvish', 'Nanico'),
        ('Giant', 'Gigante'), ('Orc', 'Orchesco'), ('Abyssal', 'Abissale'), ('Infernal', 'Infernale'), ('Celestial', 'Celestiale'),
        ('Primordial', 'Primordiale'), ('Sylvan', 'Silvano'), ('Undercommon', 'Sottocomune'), ('Deep Speech', 'Linguaggio delle Profondità'),
        ('Gnomish', 'Gnomesco'), ('Halfling', 'Halfling'), ('Sphinx', 'Sfinge'), ('Ignan', 'Ignan'), ('Terran', 'Terran'), ('Auran', 'Auran'),
        ('Aquan', 'Aquan'), ('any one language (usually Comune)', 'una lingua qualsiasi (di solito il Comune)'),
        ('any two languages', 'due lingue qualsiasi'), ('any four languages', 'quattro lingue qualsiasi'), ('any six languages', 'sei lingue qualsiasi'),
        ('the languages it knew in life', 'le lingue che conosceva in vita'), (' but can\'t speak', ' ma non le parla'),
        ('understands', 'capisce'), ('languages of its creator', 'le lingue del suo creatore'), ('all', 'tutte')]
ACTION_NAMES = {
    'Multiattack': 'Multiattacco', 'Bite': 'Morso', 'Bites': 'Morsi', 'Claw': 'Artiglio', 'Claws': 'Artigli', 'Tail': 'Coda',
    'Tail Attack': 'Attacco con la Coda', 'Magic Resistance': 'Resistenza alla Magia', 'Amphibious': 'Anfibio',
    'Frightful Presence': 'Presenza Terrificante', 'Detect': 'Individuare', 'Innate Spellcasting': 'Incantesimi Innati',
    'Keen Smell': 'Olfatto Acuto', 'Pack Tactics': 'Tattiche del Branco', 'False Appearance': 'Falso Aspetto', 'Slam': 'Schianto',
    'Hooves': 'Zoccoli', 'Spider Climb': 'Movimento del Ragno', 'Keen Hearing and Smell': 'Udito e Olfatto Acuti',
    'Spellcasting': 'Incantesimi', 'Magic Weapons': 'Armi Magiche', 'Beak': 'Becco', 'Charge': 'Carica', 'Shapechanger': 'Mutaforma',
    'Longsword': 'Spada Lunga', 'Swarm': 'Sciame', 'Change Shape': 'Cambiare Forma', 'Rock': 'Masso', 'Shortsword': 'Spada Corta',
    'Water Breathing': "Respirare sott'Acqua", "Devil's Sight": 'Vista del Diavolo', 'Longbow': 'Arco Lungo',
    'Hold Breath': 'Trattenere il Respiro', 'Talons': 'Artigli', 'Keen Sight': 'Vista Acuta', 'Sunlight Sensitivity': 'Sensibilità alla Luce Solare',
    'Web Walker': 'Camminare sulle Ragnatele', 'Gore': 'Incornata', 'Spear': 'Lancia', 'Dagger': 'Pugnale', 'Scimitar': 'Scimitarra',
    'Ram': 'Ariete', 'Fist': 'Pugno', 'Echolocation': 'Ecolocalizzazione', 'Swallow': 'Inghiottire', 'Greataxe': 'Ascia Bipenne',
    'Pseudopod': 'Pseudopodo', 'Sting': 'Pungiglione', 'Javelin': 'Giavellotto', 'Tentacles': 'Tentacoli', 'Tentacle': 'Tentacolo',
    'Stone Camouflage': 'Mimetismo nella Pietra', 'Death Burst': 'Esplosione Mortale', 'Trampling Charge': 'Carica Travolgente',
    'Web Sense': 'Senso della Ragnatela', 'Greatsword': 'Spadone', 'Blood Frenzy': 'Frenesia del Sangue', 'Invisibility': 'Invisibilità',
    'Regeneration': 'Rigenerazione', 'Club': 'Randello', 'Illumination': 'Illuminazione', 'Teleport': 'Teletrasporto',
    'Keen Hearing': 'Udito Acuto', 'Constrict': 'Stritolare', 'Amorphous': 'Amorfo', 'Morningstar': 'Morning Star',
    'Standing Leap': 'Balzo da Fermo', 'Immutable Form': 'Forma Immutabile', 'Mace': 'Mazza', 'Siege Monster': "Mostro d'Assedio",
    'Incorporeal Movement': 'Movimento Incorporeo', 'Shortbow': 'Arco Corto', 'Rejuvenation': 'Ringiovanimento',
    'Heavy Crossbow': 'Balestra Pesante', 'Pounce': 'Balzo', 'Ice Walk': 'Camminare sul Ghiaccio',
    'Antimagic Susceptibility': 'Vulnerabilità all\'Antimagia', 'Heated Body': 'Corpo Rovente', 'Hurl Flame': 'Scagliare Fiamme',
    'Angelic Weapons': 'Armi Angeliche', 'Stomp': 'Pestare', 'Flyby': 'Volo Radente', 'Etherealness': 'Forma Eterea',
    'Sure-Footed': 'Passo Sicuro', 'Keen Hearing and Sight': 'Udito e Vista Acuti', 'Keen Sight and Smell': 'Vista e Olfatto Acuti',
    'Hag Coven': 'Congrega di Megere', 'Greatclub': 'Randello Pesante', 'Life Drain': 'Risucchio Vitale', 'Inscrutable': 'Imperscrutabile',
    'Claw Attack': 'Attacco con gli Artigli', 'Light Crossbow': 'Balestra Leggera', 'Heated Weapons': 'Armi Roventi',
    'Petrifying Gaze': 'Sguardo Pietrificante', 'Glaive': 'Falcione', 'Reckless': 'Avventato', 'Tusk': 'Zanna', 'Brute': 'Bruto',
    'Surprise Attack': 'Attacco a Sorpresa', 'Horns': 'Corna', 'Pincer': 'Chela', 'Berserk': 'Berserk', 'Damage Transfer': 'Trasferire Danni',
    'Dark Devotion': 'Devozione Oscura', 'War Pick': 'Piccone da Guerra', 'Elemental Demise': 'Fine Elementale', 'Fey Ancestry': 'Retaggio Fatato',
    'Hand Crossbow': 'Balestra a Mano', 'Earth Glide': 'Scivolare nella Terra', 'Wakeful': 'Vigile', 'Touch': 'Tocco',
    'Lightning Absorption': 'Assorbire Fulmini', 'Engulf': 'Inglobare', 'Stench': 'Fetore', 'Rampage': 'Furia', 'Underwater Camouflage': 'Mimetismo Subacqueo',
    'Brave': 'Coraggioso', 'Illusory Appearance': 'Aspetto Illusorio', 'Mimicry': 'Imitazione', 'Telepathic Bond': 'Legame Telepatico',
    'Rotting Fist': 'Pugno Putrescente', 'Dreadful Glare': 'Sguardo Terrificante', 'Attack': 'Attacco', 'Undead Fortitude': 'Tempra da Non Morto',
    'Limited Telepathy': 'Telepatia Limitata', 'Divine Awareness': 'Consapevolezza Divina', 'Charm': 'Charme', 'Move': 'Movimento',
    'Vampire Weaknesses': 'Debolezze del Vampiro', 'Mucous Cloud': 'Nube di Muco', 'Probing Telepathy': 'Telepatia Indagatrice',
    'Tail Swipe': 'Colpo di Coda', 'Lair Actions': 'Azioni di Tana', 'Sneak Attack': 'Attacco Furtivo', 'Parry': 'Parata',
    'Leadership': 'Comando', 'Aggressive': 'Aggressivo', 'Martial Advantage': 'Vantaggio Marziale', 'Nimble Escape': 'Fuga Agile',
    'Shield Bash': 'Colpo di Scudo', 'Trident': 'Tridente', 'Net': 'Rete', 'Sling': 'Fionda', 'Rapier': 'Stocco', 'Warhammer': 'Martello da Guerra',
    'Maul': 'Maglio', 'Pike': 'Picca', 'Halberd': 'Alabarda', 'Flail': 'Mazzafrusto', 'Whip': 'Frusta', 'Battleaxe': 'Ascia da Battaglia',
    'Handaxe': 'Ascia', 'Quarterstaff': 'Bastone Ferrato', 'Lance': 'Lancia da Cavaliere', 'Unarmed Strike': "Colpo Senz'Armi",
    'Wing Attack': 'Attacco con le Ali', 'Breath Weapons': 'Armi a Soffio', 'Fire Breath': 'Soffio di Fuoco', 'Cold Breath': 'Soffio Gelido',
    'Lightning Breath': 'Soffio di Fulmine', 'Acid Breath': 'Soffio Acido', 'Poison Breath': 'Soffio Velenoso', 'Web': 'Ragnatela',
    'Legendary Resistance': 'Resistenza Leggendaria', 'Relentless': 'Implacabile', 'Healing Touch': 'Tocco Guaritore',
    'Ink Cloud': "Nube d'Inchiostro", 'Whirlwind': 'Turbine', 'Cast a Spell': 'Lanciare un Incantesimo', 'Psychic Drain': 'Risucchio Psichico',
    'Enslave': 'Rendere Schiavo', 'Shared Spellcasting': 'Incantesimi Condivisi', 'Hag Eye': 'Occhio della Megera',
    'Variant: Summon Demon': 'Variante: Evocare Demone', 'Variant: Summon Mephits': 'Variante: Evocare Mefiti', 'Variant: Familiar': 'Variante: Famiglio',
    'Variant: Genie Powers': 'Variante: Poteri del Genio'
}
SUFFIX = [('(Costs 2 Actions)', '(costa 2 azioni)'), ('(Costs 3 Actions)', '(costa 3 azioni)'), ('(Recharge 5-6)', '(ricarica 5-6)'),
          ('(Recharge 4-6)', '(ricarica 4-6)'), ('(Recharge 6)', '(ricarica 6)'), ('(Recharges after a Short or Long Rest)', '(si ricarica dopo un riposo)'),
          ('(3/Day)', '(3/giorno)'), ('(3/day)', '(3/giorno)'), ('(1/Day)', '(1/giorno)'), ('(4/Day)', '(4/giorno)'), ('(1/Turn)', '(1/turno)'),
          ('(Coven Only)', '(solo in congrega)'), ('(Humanoid or Hybrid Form Only)', '(solo forma umanoide o ibrida)')]

FORMS = {'Hag': 'megera', 'Hybrid': 'ibrida', 'Bear': 'orso', 'Tiger': 'tigre', 'Fiend': 'immonda', 'Oni': 'oni', 'Rat': 'ratto',
         'Boar': 'cinghiale', 'Wolf': 'lupo', 'Beast': 'bestia', 'Humanoid': 'umanoide', 'Object': 'oggetto', 'Bat': 'pipistrello',
         'Vampire': 'vampiro', 'Mist': 'nebbia'}

def form_suffix(text):
    def conv(mm):
        words = [FORMS.get(w, w) for w in re.split(r' or ', mm.group(1))]
        return '(solo forma ' + ' o '.join(words) + ')'
    return re.sub(r'\(([\w ]+?) Form Only\)\.?', conv, text)

def action_name(n):
    rest = form_suffix(n).strip()
    suffix = ''
    for en, it in SUFFIX:
        if rest.endswith(en):
            rest = rest[: -len(en)].strip()
            suffix = ' ' + it
            break
    m = re.match(r'^(.*?)\s*(\(.*\))$', rest)
    extra = ''
    if m and m.group(1) in ACTION_NAMES:
        rest, extra = m.group(1), ' ' + m.group(2)
    return ACTION_NAMES.get(rest, rest) + extra + suffix

def feet_to_m(text):
    def conv(mm):
        ft = int(mm.group(1).replace(',', ''))
        meters = ft * 0.3
        s = f"{meters:.1f}".rstrip('0').rstrip('.').replace('.', ',')
        return f"{s} m"
    return re.sub(r'(\d[\d,]*)\s*(?:ft\.|feet|foot)', conv, text)

def translate_words(text, pairs):
    for en, it in pairs:
        text = text.replace(en, it)
    return text

def damage_list(text):
    t = text
    t = t.replace('from nonmagical weapons', 'da armi non magiche').replace('from nonmagical attacks', 'da attacchi non magici')
    t = t.replace("that aren't silvered", 'non argentate').replace("that aren't adamantine", 'non adamantine')
    t = t.replace(' and ', ' e ')
    for en, it in DAMAGE.items():
        t = re.sub(rf'\b{en}\b', it, t)
    return t

def cr_str(cr):
    return {0.125: '1/8', 0.25: '1/4', 0.5: '1/2'}.get(cr, str(int(cr)))

def build_monster(x):
    speed = []
    for k, v in x['speed'].items():
        if k == 'hover':
            continue
        label = {'walk': '', 'fly': 'volare ', 'swim': 'nuotare ', 'climb': 'scalare ', 'burrow': 'scavare '}[k]
        val = feet_to_m(v)
        if k == 'fly' and x['speed'].get('hover'):
            val += ' (fluttuare)'
        speed.append(label + val)
    saves, skills = [], []
    for p in x.get('proficiencies', []):
        n = p['name']
        if n.startswith('Saving Throw: '):
            saves.append(f"{ABIL[n[14:]]} +{p['value']}")
        elif n.startswith('Skill: '):
            skills.append(f"{SKILLS.get(n[7:], n[7:])} +{p['value']}")
    senses = []
    for k, v in x['senses'].items():
        if k == 'passive_perception':
            continue
        senses.append({'darkvision': 'scurovisione', 'blindsight': 'vista cieca', 'tremorsense': 'percezione tellurica', 'truesight': 'visione del vero'}[k] + ' ' + feet_to_m(v))
    senses.append(f"Percezione passiva {x['senses'].get('passive_perception', 10)}")

    def ability(a, is_action=False):
        out = {'n': action_name(a['name']), 'd': a.get('desc', '')}
        if a.get('attack_bonus') is not None and 'Attack:' in a.get('desc', ''):
            out['hit'] = a['attack_bonus']
        dmg = []
        raw = a.get('damage', []) or []
        if isinstance(raw, dict):
            raw = [raw]
        for d in raw:
            if not isinstance(d, dict):
                continue
            if 'from' in d and isinstance(d['from'], list) and d['from']:
                d = d['from'][0]
            if 'damage_dice' not in d:
                continue
            f = d['damage_dice'].replace(' ', '')
            if d.get('damage_bonus'):
                f += f"{'+' if d['damage_bonus'] > 0 else ''}{d['damage_bonus']}"
            t = DAMAGE.get(d.get('damage_type', {}).get('name', '').lower(), '')
            dmg.append({'f': f, 't': t})
        desc = a.get('desc', '')
        if not dmg:
            # Danni scritti solo nella descrizione, es. "taking 22 (4d10) poison damage"
            for mm in re.finditer(r'\((\d+d\d+(?: [+-] \d+)?)\) (acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder) damage', desc):
                dmg.append({'f': mm.group(1).replace(' ', ''), 't': DAMAGE[mm.group(2)]})
        if dmg:
            out['dmg'] = dmg
        if a.get('dc'):
            out['dc'] = f"{ABIL.get(a['dc']['dc_type']['name'], a['dc']['dc_type']['name'])} {a['dc']['dc_value']}"
        else:
            mm = re.search(r'DC (\d+) (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw', desc)
            if mm:
                out['dc'] = f"{ {'Strength': 'FOR', 'Dexterity': 'DES', 'Constitution': 'COS', 'Intelligence': 'INT', 'Wisdom': 'SAG', 'Charisma': 'CAR'}[mm.group(2)]} {mm.group(1)}"
        return out

    return {
        'i': x['index'], 'n': monster_name(x['name']), 'e': x['name'],
        'sz': SIZES[x['size']], 'ty': TYPES.get(x['type'], x['type']) + (f" ({SUBTYPES.get(x['subtype'], x['subtype'])})" if x.get('subtype') else ''),
        'al': translate_words(x['alignment'], ALIGN_WORDS),
        'ca': x['armor_class'], 'hp': x['hit_points'], 'hd': x['hit_dice'], 'sp': ', '.join(speed),
        'ab': [x['strength'], x['dexterity'], x['constitution'], x['intelligence'], x['wisdom'], x['charisma']],
        'sv': ', '.join(saves), 'sk': ', '.join(skills),
        'vul': damage_list(', '.join(x.get('damage_vulnerabilities', []))),
        'res': damage_list(', '.join(x.get('damage_resistances', []))),
        'imm': damage_list(', '.join(x.get('damage_immunities', []))),
        'cim': ', '.join(CONDITIONS.get(c['name'].lower(), c['name']) for c in x.get('condition_immunities', [])),
        'se': ', '.join(senses), 'la': feet_to_m(translate_words(x['languages'], LANG)) if x['languages'] else '—',
        'cr': cr_str(x['challenge_rating']),
        'tr': [ability(a) for a in x.get('special_abilities', [])],
        'act': [ability(a, True) for a in x.get('actions', [])],
        'leg': [ability(a) for a in x.get('legendary_actions', [])]
    }

# ---------------------------------------------------------------- incantesimi
SPELL_NAMES = {
    'Acid Arrow': 'Freccia Acida', 'Acid Splash': 'Fiotto Acido', 'Aid': 'Aiuto', 'Alarm': 'Allarme', 'Alter Self': 'Alterare Se Stesso',
    'Animal Friendship': 'Amicizia con gli Animali', 'Animal Messenger': 'Messaggero Animale', 'Animal Shapes': 'Forme Animali',
    'Animate Dead': 'Animare Morti', 'Animate Objects': 'Animare Oggetti', 'Antilife Shell': 'Guscio Anti-vita',
    'Antimagic Field': 'Campo Anti-magia', 'Antipathy/Sympathy': 'Antipatia/Simpatia', 'Arcane Eye': 'Occhio Arcano',
    'Arcane Hand': 'Mano Arcana', 'Arcane Lock': 'Serratura Arcana', 'Arcane Sword': 'Spada Arcana',
    "Arcanist's Magic Aura": "Aura Magica dell'Arcanista", 'Astral Projection': 'Proiezione Astrale', 'Augury': 'Presagio',
    'Awaken': 'Risveglio', 'Bane': 'Anatema', 'Banishment': 'Esilio', 'Barkskin': 'Pelle di Corteccia', 'Beacon of Hope': 'Faro di Speranza',
    'Bestow Curse': 'Scagliare Maledizione', 'Black Tentacles': 'Tentacoli Neri', 'Blade Barrier': 'Barriera di Lame', 'Bless': 'Benedizione',
    'Blight': 'Avvizzire', 'Blindness/Deafness': 'Cecità/Sordità', 'Blink': 'Intermittenza', 'Blur': 'Sfocatura',
    'Branding Smite': 'Punizione Marchiante', 'Burning Hands': 'Mani Brucianti', 'Call Lightning': 'Invocare il Fulmine',
    'Calm Emotions': 'Calmare Emozioni', 'Chain Lightning': 'Catena di Fulmini', 'Charm Person': 'Charme su Persone',
    'Chill Touch': 'Tocco Gelido', 'Circle of Death': 'Cerchio di Morte', 'Clairvoyance': 'Chiaroveggenza', 'Clone': 'Clone',
    'Cloudkill': 'Nube Mortale', 'Color Spray': 'Spruzzo Colorato', 'Command': 'Comando', 'Commune': 'Comunione',
    'Commune with Nature': 'Comunione con la Natura', 'Comprehend Languages': 'Comprensione dei Linguaggi', 'Compulsion': 'Costrizione',
    'Cone of Cold': 'Cono di Freddo', 'Confusion': 'Confusione', 'Conjure Animals': 'Evocare Animali', 'Conjure Celestial': 'Evocare Celestiale',
    'Conjure Elemental': 'Evocare Elementale', 'Conjure Fey': 'Evocare Folletto', 'Conjure Minor Elementals': 'Evocare Elementali Minori',
    'Conjure Woodland Beings': 'Evocare Creature Silvane', 'Contact Other Plane': 'Contattare Altri Piani', 'Contagion': 'Contagio',
    'Contingency': 'Contingenza', 'Continual Flame': 'Fiamma Perenne', 'Control Water': 'Controllare Acqua',
    'Control Weather': 'Controllare il Tempo Atmosferico', 'Counterspell': 'Controincantesimo', 'Create Food and Water': 'Creare Cibo e Acqua',
    'Create Undead': 'Creare Non Morti', 'Create or Destroy Water': 'Creare o Distruggere Acqua', 'Creation': 'Creazione',
    'Cure Wounds': 'Cura Ferite', 'Dancing Lights': 'Luci Danzanti', 'Darkness': 'Oscurità', 'Darkvision': 'Scurovisione',
    'Daylight': 'Luce Diurna', 'Death Ward': 'Interdizione alla Morte', 'Delayed Blast Fireball': 'Palla di Fuoco Ritardata',
    'Demiplane': 'Semipiano', 'Detect Evil and Good': 'Individuazione del Bene e del Male', 'Detect Magic': 'Individuazione del Magico',
    'Detect Poison and Disease': 'Individuazione delle Malattie e del Veleno', 'Detect Thoughts': 'Individuazione dei Pensieri',
    'Dimension Door': 'Porta Dimensionale', 'Disguise Self': 'Camuffare Se Stessi', 'Disintegrate': 'Disintegrazione',
    'Dispel Evil and Good': 'Dissolvi il Bene e il Male', 'Dispel Magic': 'Dissolvi Magie', 'Divination': 'Divinazione',
    'Divine Favor': 'Favore Divino', 'Divine Word': 'Parola Divina', 'Dominate Beast': 'Dominare Bestie', 'Dominate Monster': 'Dominare Mostri',
    'Dominate Person': 'Dominare Persone', 'Dream': 'Sogno', 'Druidcraft': 'Artificio Druidico', 'Earthquake': 'Terremoto',
    'Eldritch Blast': 'Deflagrazione Occulta', 'Enhance Ability': 'Potenziare Caratteristica', 'Enlarge/Reduce': 'Ingrandire/Ridurre',
    'Entangle': 'Intralciare', 'Enthrall': 'Ammaliare', 'Etherealness': 'Forma Eterea', 'Expeditious Retreat': 'Ritirata Rapida',
    'Eyebite': 'Sguardo Penetrante', 'Fabricate': 'Fabbricare', 'Faerie Fire': 'Luminescenza', 'Faithful Hound': 'Segugio Fedele',
    'False Life': 'Vita Falsata', 'Fear': 'Paura', 'Feather Fall': 'Caduta Morbida', 'Feeblemind': 'Debilitare Mente',
    'Find Familiar': 'Trova Famiglio', 'Find Steed': 'Trova Destriero', 'Find Traps': 'Trova Trappole', 'Find the Path': 'Trova il Percorso',
    'Finger of Death': 'Dito della Morte', 'Fire Bolt': 'Dardo di Fuoco', 'Fire Shield': 'Scudo di Fuoco', 'Fire Storm': 'Tempesta di Fuoco',
    'Fireball': 'Palla di Fuoco', 'Flame Blade': 'Lama Infuocata', 'Flame Strike': 'Colpo Infuocato', 'Flaming Sphere': 'Sfera Infuocata',
    'Flesh to Stone': 'Carne in Pietra', 'Floating Disk': 'Disco Fluttuante', 'Fly': 'Volare', 'Fog Cloud': 'Nube di Nebbia',
    'Forbiddance': 'Divieto', 'Forcecage': 'Gabbia di Forza', 'Foresight': 'Preveggenza', 'Freedom of Movement': 'Libertà di Movimento',
    'Freezing Sphere': 'Sfera Congelante', 'Gaseous Form': 'Forma Gassosa', 'Gate': 'Portale', 'Geas': 'Obbligo',
    'Gentle Repose': 'Riposo Inviolato', 'Giant Insect': 'Insetto Gigante', 'Glibness': 'Parlantina',
    'Globe of Invulnerability': 'Globo di Invulnerabilità', 'Glyph of Warding': 'Glifo di Interdizione', 'Goodberry': 'Bacche Benefiche',
    'Grease': 'Unto', 'Greater Invisibility': 'Invisibilità Superiore', 'Greater Restoration': 'Ristorare Superiore',
    'Guardian of Faith': 'Guardiano della Fede', 'Guards and Wards': 'Guardie e Interdizioni', 'Guidance': 'Guida',
    'Guiding Bolt': 'Dardo Tracciante', 'Gust of Wind': 'Folata di Vento', 'Hallow': 'Consacrare', 'Hallucinatory Terrain': 'Terreno Illusorio',
    'Harm': 'Ferire', 'Haste': 'Velocità', 'Heal': 'Guarigione', 'Healing Word': 'Parola Guaritrice', 'Heat Metal': 'Riscaldare il Metallo',
    'Hellish Rebuke': 'Rimprovero Infernale', "Heroes' Feast": 'Banchetto degli Eroi', 'Heroism': 'Eroismo',
    'Hideous Laughter': 'Risata Incontenibile', 'Hold Monster': 'Blocca Mostri', 'Hold Person': 'Blocca Persone', 'Holy Aura': 'Aura Sacra',
    "Hunter's Mark": 'Marchio del Cacciatore', 'Hypnotic Pattern': 'Trama Ipnotica', 'Ice Storm': 'Tempesta di Ghiaccio',
    'Identify': 'Identificare', 'Illusory Script': 'Scritto Illusorio', 'Imprisonment': 'Imprigionare', 'Incendiary Cloud': 'Nube Incendiaria',
    'Inflict Wounds': 'Infliggi Ferite', 'Insect Plague': 'Piaga di Insetti', 'Instant Summons': 'Richiamo Istantaneo',
    'Invisibility': 'Invisibilità', 'Irresistible Dance': 'Danza Irresistibile', 'Jump': 'Saltare', 'Knock': 'Scassinare',
    'Legend Lore': 'Conoscenza delle Leggende', 'Lesser Restoration': 'Ristorare Inferiore', 'Levitate': 'Levitazione', 'Light': 'Luce',
    'Lightning Bolt': 'Fulmine', 'Locate Animals or Plants': 'Localizzare Animali o Vegetali', 'Locate Creature': 'Localizzare Creatura',
    'Locate Object': 'Localizzare Oggetto', 'Longstrider': 'Passo Veloce', 'Mage Armor': 'Armatura Magica', 'Mage Hand': 'Mano Magica',
    'Magic Circle': 'Cerchio Magico', 'Magic Jar': 'Giara Magica', 'Magic Missile': 'Dardo Incantato', 'Magic Mouth': 'Bocca Magica',
    'Magic Weapon': 'Arma Magica', 'Magnificent Mansion': 'Magnifica Dimora', 'Major Image': 'Immagine Maggiore',
    'Mass Cure Wounds': 'Cura Ferite di Massa', 'Mass Heal': 'Guarigione di Massa', 'Mass Healing Word': 'Parola Guaritrice di Massa',
    'Mass Suggestion': 'Suggestione di Massa', 'Maze': 'Labirinto', 'Meld into Stone': 'Fondersi nella Pietra', 'Mending': 'Riparare',
    'Message': 'Messaggio', 'Meteor Swarm': 'Sciame di Meteore', 'Mind Blank': 'Vuoto Mentale', 'Minor Illusion': 'Illusione Minore',
    'Mirage Arcane': 'Miraggio Arcano', 'Mirror Image': 'Immagine Speculare', 'Mislead': 'Sviare', 'Misty Step': 'Passo Velato',
    'Modify Memory': 'Modificare Memoria', 'Moonbeam': 'Raggio Lunare', 'Move Earth': 'Muovere il Terreno', 'Nondetection': 'Anti-individuazione',
    'Pass without Trace': 'Passare Senza Tracce', 'Passwall': 'Passapareti', 'Phantasmal Killer': 'Assassino Fantasmatico',
    'Phantom Steed': 'Destriero Fantomatico', 'Planar Ally': 'Alleato Planare', 'Planar Binding': 'Legame Planare',
    'Plane Shift': 'Spostamento Planare', 'Plant Growth': 'Crescita Vegetale', 'Poison Spray': 'Spruzzo Velenoso', 'Polymorph': 'Metamorfosi',
    'Power Word Kill': 'Parola del Potere Uccidere', 'Power Word Stun': 'Parola del Potere Stordire', 'Prayer of Healing': 'Preghiera di Guarigione',
    'Prestidigitation': 'Prestidigitazione', 'Prismatic Spray': 'Spruzzo Prismatico', 'Prismatic Wall': 'Muro Prismatico',
    'Private Sanctum': 'Santuario Privato', 'Produce Flame': 'Produrre Fiamma', 'Programmed Illusion': 'Illusione Programmata',
    'Project Image': 'Proiettare Immagine', 'Protection from Energy': "Protezione dall'Energia",
    'Protection from Evil and Good': 'Protezione dal Bene e dal Male', 'Protection from Poison': 'Protezione dal Veleno',
    'Purify Food and Drink': 'Purificare Cibo e Bevande', 'Raise Dead': 'Rianimare Morti', 'Ray of Enfeeblement': 'Raggio di Indebolimento',
    'Ray of Frost': 'Raggio di Gelo', 'Regenerate': 'Rigenerazione', 'Reincarnate': 'Reincarnazione', 'Remove Curse': 'Rimuovi Maledizione',
    'Resilient Sphere': 'Sfera Elastica', 'Resistance': 'Resistenza', 'Resurrection': 'Resurrezione', 'Reverse Gravity': 'Inversione della Gravità',
    'Revivify': 'Revivificare', 'Rope Trick': 'Corda Magica', 'Sacred Flame': 'Fiamma Sacra', 'Sanctuary': 'Santuario',
    'Scorching Ray': 'Raggio Rovente', 'Scrying': 'Scrutare', 'Secret Chest': 'Scrigno Segreto', 'See Invisibility': 'Vedere Invisibilità',
    'Seeming': 'Sembianza', 'Sending': 'Inviare', 'Sequester': 'Segregare', 'Shapechange': 'Cambiare Forma', 'Shatter': 'Frantumare',
    'Shield': 'Scudo', 'Shield of Faith': 'Scudo della Fede', 'Shillelagh': 'Randello Incantato', 'Shocking Grasp': 'Stretta Folgorante',
    'Silence': 'Silenzio', 'Silent Image': 'Immagine Silenziosa', 'Simulacrum': 'Simulacro', 'Sleep': 'Sonno', 'Sleet Storm': 'Tempesta di Nevischio',
    'Slow': 'Lentezza', 'Spare the Dying': 'Salvare i Morenti', 'Speak with Animals': 'Parlare con gli Animali', 'Speak with Dead': 'Parlare con i Morti',
    'Speak with Plants': 'Parlare con i Vegetali', 'Spider Climb': 'Movimenti del Ragno', 'Spike Growth': 'Crescita Spinosa',
    'Spirit Guardians': 'Guardiani Spirituali', 'Spiritual Weapon': 'Arma Spirituale', 'Stinking Cloud': 'Nube Maleodorante',
    'Stone Shape': 'Scolpire Pietra', 'Stoneskin': 'Pelle di Pietra', 'Storm of Vengeance': 'Tempesta della Vendetta', 'Suggestion': 'Suggestione',
    'Sunbeam': 'Raggio Solare', 'Sunburst': 'Esplosione Solare', 'Symbol': 'Simbolo', 'Telekinesis': 'Telecinesi',
    'Telepathic Bond': 'Legame Telepatico', 'Teleport': 'Teletrasporto', 'Teleportation Circle': 'Cerchio di Teletrasporto',
    'Thaumaturgy': 'Taumaturgia', 'Thunderwave': 'Onda Tonante', 'Time Stop': 'Fermare il Tempo', 'Tiny Hut': 'Piccolo Rifugio',
    'Tongues': 'Linguaggi', 'Transport via Plants': 'Trasporto Vegetale', 'Tree Stride': 'Passo Arboreo', 'True Polymorph': 'Metamorfosi Pura',
    'True Resurrection': 'Resurrezione Pura', 'True Seeing': 'Visione del Vero', 'True Strike': 'Colpo Accurato',
    'Unseen Servant': 'Servitore Inosservato', 'Vampiric Touch': 'Tocco del Vampiro', 'Vicious Mockery': 'Scherno Crudele',
    'Wall of Fire': 'Muro di Fuoco', 'Wall of Force': 'Muro di Forza', 'Wall of Ice': 'Muro di Ghiaccio', 'Wall of Stone': 'Muro di Pietra',
    'Wall of Thorns': 'Muro di Spine', 'Warding Bond': 'Legame di Interdizione', 'Water Breathing': "Respirare sott'Acqua",
    'Water Walk': "Camminare sull'Acqua", 'Web': 'Ragnatela', 'Weird': 'Incubo', 'Wind Walk': 'Camminare nel Vento', 'Wind Wall': 'Muro di Vento',
    'Wish': 'Desiderio', 'Word of Recall': 'Parola del Richiamo', 'Zone of Truth': 'Zona di Verità'
}
SCHOOLS = {'Abjuration': 'Abiurazione', 'Conjuration': 'Evocazione', 'Divination': 'Divinazione', 'Enchantment': 'Ammaliamento',
           'Evocation': 'Invocazione', 'Illusion': 'Illusione', 'Necromancy': 'Necromanzia', 'Transmutation': 'Trasmutazione'}
CLASSES = {'Bard': 'Bardo', 'Cleric': 'Chierico', 'Druid': 'Druido', 'Paladin': 'Paladino', 'Ranger': 'Ranger', 'Sorcerer': 'Stregone',
           'Warlock': 'Warlock', 'Wizard': 'Mago'}
TIME_UNITS = [('bonus action', 'azione bonus'), ('action', 'azione'), ('reaction', 'reazione'), ('minutes', 'minuti'), ('minute', 'minuto'),
              ('hours', 'ore'), ('hour', 'ora'), ('days', 'giorni'), ('day', 'giorno'), ('rounds', 'round'), ('round', 'round')]

def spell_time(t):
    return translate_words(t, TIME_UNITS)

def spell_duration(d):
    if d == 'Instantaneous': return 'Istantanea'
    if d == 'Until dispelled': return 'Finché non viene dissolto'
    if d == 'Special': return 'Speciale'
    m = re.match(r'^Up to (.+)$', d)
    if m: return 'Concentrazione, fino a ' + translate_words(m.group(1), TIME_UNITS)
    return translate_words(d, TIME_UNITS)

def spell_range(r):
    fixed = {'Touch': 'Contatto', 'Self': 'Incantatore', 'Sight': 'Vista', 'Unlimited': 'Illimitata', 'Special': 'Speciale',
             '1 mile': '1,5 km', '500 miles': '750 km'}
    return fixed.get(r, feet_to_m(r))

def build_spell(x):
    desc = '\n\n'.join(x.get('desc', []))
    hl = '\n\n'.join(x.get('higher_level', []) or [])
    out = {
        'i': x['index'], 'n': SPELL_NAMES[x['name']], 'e': x['name'], 'lv': x['level'],
        'sc': SCHOOLS[x['school']['name']], 'ct': spell_time(x['casting_time']), 'rg': spell_range(x['range']),
        'co': ', '.join(x['components']) + (f" ({x['material']})" if x.get('material') else ''),
        'du': spell_duration(x['duration']), 'conc': bool(x.get('concentration')), 'rit': bool(x.get('ritual')),
        'cl': [CLASSES[c['name']] for c in x.get('classes', []) if c['name'] in CLASSES], 'd': desc
    }
    if hl:
        out['hl'] = hl
    m = re.search(r'(\d+d\d+(?:\s*\+\s*\d+)?) (acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder) damage', desc)
    if m:
        out['dmg'] = {'f': m.group(1).replace(' ', ''), 't': DAMAGE[m.group(2)]}
    m = re.search(r'regains? (?:a number of )?hit points equal to (\d+d\d+)', desc)
    if m:
        out['heal'] = m.group(1)
    m = re.search(r'make an? (strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw', desc, re.I)
    if m:
        out['save'] = {'strength': 'FOR', 'dexterity': 'DES', 'constitution': 'COS', 'intelligence': 'INT', 'wisdom': 'SAG', 'charisma': 'CAR'}[m.group(1).lower()]
    if re.search(r'(ranged|melee) spell attack', desc):
        out['atk'] = True
    m = re.search(r'increases by (\d+d\d+) for each (?:slot )?level above', hl)
    if m:
        out['up'] = m.group(1)
    return out

os.makedirs(OUT, exist_ok=True)
mon = sorted((build_monster(x) for x in monsters), key=lambda x: x['n'])
spl = sorted((build_spell(x) for x in spells), key=lambda x: (x['lv'], x['n']))
json.dump(mon, open(os.path.join(OUT, 'srd-monsters.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(spl, open(os.path.join(OUT, 'srd-spells.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('mostri', len(mon), 'incantesimi', len(spl))
untranslated = sorted({a['n'] for m_ in mon for a in m_['tr'] + m_['act'] + m_['leg'] if re.search(r'[A-Z][a-z]+ [A-Z]', a['n']) and a['n'] == a['n']})
print('nomi di azioni rimasti in inglese (esempi):', [n for n in untranslated if not any(w in n for w in ['Gigante', 'Soffio', 'Variante'])][:40])
