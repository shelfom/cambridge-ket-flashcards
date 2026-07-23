#!/usr/bin/env python3
"""Build a complete local course from the official extraction and ECDICT.

This is the deterministic fallback/content audit path. It preserves the
approved A cards and Cambridge's complete example sentences. New explanations
are shortened to child-readable clauses and the output stays fully data-driven.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path


TOPIC_TERM_ALIASES = {
    "lights": ["light"],
    "rucksack": ["backpack"],
    "shoes": ["shoe"],
    "trainers": ["trainer"],
    "piece of cake": ["cake"],
    "go shopping": ["shopping"],
    "holidays": ["holiday"],
    "rubbish": ["bin"],
    "kilo(gram[me])/kg": ["kilogramme (kg)"],
    "tourist information": ["tourist information centre"],
    "January - December": [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ],
    "Monday - Sunday": [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ],
}


PHRASE_DEFINITIONS = {
    "alarm clock": "a clock that wakes you up",
    "all kinds of": "many different kinds of",
    "all right/alright": "well safe or not hurt",
    "all sorts of": "many different kinds of",
    "all the time": "very often or always",
    "apartment building": "a building with many homes",
    "app": "a program on a phone or computer",
    "as well": "also or too",
    "as well (as)": "and also",
    "at all": "in any way",
    "bathing suit": "clothes worn for swimming",
    "because of": "for this reason",
    "board game": "a game played on a board",
    "break down": "to stop working",
    "bring back": "to return with something",
    "business person": "a person who works in business",
    "bus station": "a place where buses arrive",
    "bus stop": "a place where buses stop",
    "by accident": "without planning it",
    "by the way": "used to add something new",
    "by post": "sent through the mail",
    "car park": "a place to leave cars",
    "CD player": "a machine that plays CDs",
    "cell phone": "a phone you carry",
    "chatroom": "an online place to talk",
    "city centre": "the middle part of a city",
    "close to": "near someone or something",
    "come back": "to return to a place",
    "credit card": "a card used to pay",
    "department store": "a large shop with many sections",
    "digital camera": "a camera that saves pictures",
    "dining room": "a room where people eat",
    "Dr": "a short way to write doctor",
    "DVD player": "a machine that plays DVDs",
    "each other": "one person to the other",
    "fall over": "to fall to the ground",
    "fast food": "food made and served quickly",
    "fill in": "to write in empty spaces",
    "find out": "to learn something new",
    "first name": "the name before your family name",
    "first of all": "before anything else",
    "football player": "a person who plays football",
    "for sale": "ready for someone to buy",
    "French fries": "thin pieces of fried potato",
    "gas station": "a place that sells car fuel",
    "get back": "to return to a place",
    "get dressed": "to put your clothes on",
    "get fit": "to make your body strong",
    "get married": "to become husband and wife",
    "get off": "to leave a bus or train",
    "get on": "to enter a bus or train",
    "get up": "to leave your bed",
    "give back": "to return something",
    "good afternoon": "hello said after midday",
    "good evening": "hello said in the evening",
    "good morning": "hello said in the morning",
    "good night": "words said before sleep",
    "go out": "to leave home for fun",
    "grocery store": "a shop that sells food",
    "grow up": "to become an adult",
    "Guess what?": "words before surprising news",
    "guest-house": "a small place for visitors to stay",
    "have got to": "must do something",
    "have to": "must do something",
    "headteacher": "the teacher who leads a school",
    "hip hop": "music with a strong beat",
    "hoodie": "a warm top with a hood",
    "ice cream": "a sweet cold food",
    "ice skating": "moving on ice with skates",
    "ID card": "a card that shows who you are",
    "in front of": "before or facing something",
    "instead of": "in the place of",
    "lie down": "to put your body flat",
    "living room": "a room for sitting together",
    "look after": "to care for someone",
    "look at": "to turn your eyes towards",
    "look for": "to try to find",
    "look out": "to be careful",
    "main course": "the biggest part of a meal",
    "make sure (that)": "to check that something is true",
    "mineral water": "water from under the ground",
    "movie star": "a famous film actor",
    "movie theater": "a place to watch films",
    "next to": "very close beside",
    "no one": "not any person",
    "of course": "yes as you would expect",
    "oh dear!": "words showing worry or surprise",
    "out of": "from inside to outside",
    "parking lot": "a place to leave cars",
    "pencil case": "a small bag for pencils",
    "penfriend": "a friend who writes letters",
    "petrol station": "a place that sells car fuel",
    "pick up": "to lift or collect something",
    "polar bear": "a large white bear",
    "police car": "a car used by police",
    "police officer": "a person who keeps people safe",
    "police station": "a building where police work",
    "put on": "to place clothes on your body",
    "right hand": "the hand on your right side",
    "shop assistant": "a person who helps in a shop",
    "shopping centre": "a place with many shops",
    "sit down": "to move into a seat",
    "sitting room": "a room for sitting together",
    "social media": "websites where people share things",
    "sports centre": "a place for doing sport",
    "stomach ache": "pain inside your stomach",
    "swimming costume": "clothes worn for swimming",
    "swimming pool": "a place filled with water for swimming",
    "table tennis": "a small ball game on a table",
    "take off": "to remove clothes or leave the ground",
    "take part": "to join an activity",
    "tennis player": "a person who plays tennis",
    "text message": "a short message sent by phone",
    "thank you": "words said when someone helps",
    "theirs": "belonging to those people",
    "tidy up": "to make a place neat",
    "tour guide": "a person who shows visitors around",
    "tourist information centre": "a place that helps visitors",
    "traffic light": "lights that tell cars when to move",
    "try on": "to put on clothes to check them",
    "turn off": "to stop a machine or light",
    "turn on": "to start a machine or light",
    "video game": "a game played on a screen",
    "wake up": "to stop sleeping",
    "washing machine": "a machine that washes clothes",
    "wash up": "to wash plates and cups",
    "web page": "one page on a website",
    "well known": "known by many people",
    "work out": "to exercise your body",
    "working hours": "the time spent at work",
    "write down": "to put words on paper",
}

DEFINITION_OVERRIDES = {
    "backpack": "a bag carried on your back",
    "become": "to change into something different",
    "before": "earlier than someone or something else",
    "behind": "at or towards the back of something",
    "belong": "to be owned by someone",
    "beside": "next to someone or something",
    "between": "in the middle of two things",
    "birth": "the time when a baby is born",
    "boiled": "cooked in very hot water",
    "bookshelf": "a shelf that holds books",
    "born": "brought into life as a baby",
    "bright": "giving out lots of light",
    "business": "buying and selling things",
    "climbing": "moving up a wall or hill",
    "computer": "a machine used for work and games",
    "contact": "communication with another person",
    "cousin": "a child of your aunt or uncle",
    "cover": "a thing placed over something else",
    "cycling": "riding a bicycle",
    "dancing": "moving your body to music",
    "degree": "a unit for measuring heat or angles",
    "delayed": "made to happen later",
    "desk": "a table for reading or writing",
    "diving": "jumping or swimming down into water",
    "dressed": "wearing clothes on your body",
    "earn": "to get money for doing work",
    "entrance": "a place where you go in",
    "extinct": "with no animals of this kind alive",
    "eye": "a body part used for seeing",
    "fact": "something that is known to be true",
    "fire": "heat and light from burning things",
    "fishing": "trying to catch fish",
    "football": "a team game played with a ball",
    "golden": "made of gold or gold-coloured",
    "grow": "to become bigger or older",
    "guidebook": "a book with facts for visitors",
    "guitar": "a musical instrument with strings",
    "gym": "a place for exercise and sport",
    "hand": "the part at the end of your arm",
    "hate": "to dislike someone or something very much",
    "helpful": "making a task easier for someone",
    "him": "the male person already talked about",
    "hip hop": "music with a strong beat",
    "hippo": "a very large grey African animal",
    "identification": "something that shows who a person is",
    "impossible": "not able to happen or be done",
    "inside": "in the inner part of something",
    "instead": "in the place of something else",
    "jazz": "music with a strong beat and free style",
    "last": "coming after all the others",
    "leg": "a body part used for walking",
    "lost": "not knowing where you are",
    "March": "the third month of the year",
    "mirror": "glass that shows your face",
    "movie star": "a famous actor in films",
    "musical": "about music or good at music",
    "national": "about a whole country",
    "noise": "a sound that is loud or unwanted",
    "opera": "a story told through singing and music",
    "opposite": "across from or very different from",
    "ours": "belonging to us",
    "own": "belonging to you and no one else",
    "passport": "a document for travel to other countries",
    "PC (personal computer)": "a small computer for one person",
    "performance (ENTERTAINMENT)": "a show of acting, music, or dance",
    "piano": "a musical instrument with black and white keys",
    "play": "a story acted on a stage",
    "pop": "a type of popular music",
    "riding": "travelling on a horse or bicycle",
    "running": "moving fast on your feet",
    "shopping": "buying things from shops",
    "short": "not long or not tall",
    "sing": "to make music with your voice",
    "singing": "making music with your voice",
    "skateboarding": "riding on a board with wheels",
    "skating": "moving on ice or wheels with skates",
    "smoking": "breathing in smoke from a cigarette",
    "soup": "a liquid food eaten hot or cold",
    "stadium": "a large place where people watch sport",
    "storm": "very bad weather with strong wind",
    "strawberry": "a small soft red fruit",
    "surprising": "making you feel sudden wonder",
    "technology": "machines and tools made using science",
    "text": "written words or a phone message",
    "their": "belonging to those people",
    "thunderstorm": "a storm with thunder and lightning",
    "timetable": "a list showing when things happen",
    "T-shirt": "a short-sleeved top",
    "type": "a group of similar things",
    "under": "below or lower than something",
    "until": "up to a particular time",
    "view": "what you can see from a place",
    "violin": "a small musical instrument with four strings",
    "walking": "moving somewhere on your feet",
    "weekly": "happening once every week",
    "wet": "covered with water or another liquid",
    "wifi": "wireless internet for phones and computers",
    "wild": "living in nature, not with people",
    "windy": "with a lot of wind",
    "wood": "the hard material inside a tree",
    "bath": "washing your body in water",
    "bathtub": "a large container used for having a bath",
    "bicycle": "a two-wheeled vehicle moved with pedals",
    "blanket": "a warm cover used on a bed",
    "bookcase": "a piece of furniture with shelves for books",
    "brain": "the body part used for thinking",
    "bridge": "a road or path over something",
    "cabinet": "a cupboard with shelves or drawers",
    "cola": "a sweet fizzy brown drink",
    "court": "an area where tennis is played",
    "curtain": "cloth hung over a window",
    "danger": "the chance that something bad may happen",
    "diary": "a book for writing about each day",
    "diploma": "a paper showing you finished a course",
    "dog": "an animal often kept as a pet",
    "door": "a part of a wall that opens",
    "drawer": "a sliding box in a desk or cupboard",
    "DVD": "a disc holding films or other information",
    "engine": "the part that makes a vehicle move",
    "environment": "the natural world around us",
    "euro": "money used in many European countries",
    "foot": "the part at the end of your leg",
    "furniture": "large things such as tables and chairs",
    "garlic": "a strong-tasting plant used in cooking",
    "hair": "thin strands that grow on your head",
    "health": "how well or ill your body is",
    "hockey": "a team game played with sticks",
    "I": "the person who is speaking or writing",
    "ID": "a card that shows who you are",
    "island": "land with water all around it",
    "it": "a thing or animal already talked about",
    "IT": "computers and other electronic technology",
    "jewellery": "small beautiful things worn on the body",
    "jumper": "a warm top with long sleeves",
    "language": "words used by people to communicate",
    "laptop (computer)": "a small computer you can carry",
    "licence": "an official paper giving you permission",
    "lorry": "a large vehicle for carrying goods",
    "luggage": "bags and cases used when travelling",
    "May": "the fifth month of the year",
    "me": "the person speaking or writing",
    "medicine": "something used to make illness better",
    "melon": "a large sweet fruit with many seeds",
    "menu": "a list of food in a restaurant",
    "metre": "a unit used for measuring length",
    "mobile (phone)": "a phone you can carry",
    "model": "a small copy of something larger",
    "no one": "not any person",
    "them": "people or things already talked about",
    "they": "people or things already talked about",
    "we": "the speaker together with other people",
    "bored": "not interested because there is nothing to do",
    "classical": "traditional and from a long time ago",
    "clever": "quick to learn and understand things",
    "close": "near in place or time",
    "cloudy": "with many clouds in the sky",
    "comfortable": "making your body feel relaxed",
    "dead": "not alive any more",
    "deep": "going far down from the top",
    "delicious": "tasting very good",
    "difficult": "not easy to do",
    "digital": "using computers or electronic signals",
    "electric": "using or making electricity",
    "excellent": "very, very good",
    "expensive": "costing a lot of money",
    "fat": "having too much body weight",
    "foggy": "with a lot of fog",
    "friendly": "kind and pleasant to other people",
    "fun": "enjoyable and making you happy",
    "further": "more distant or at a later point",
    "glass": "made of glass",
    "grilled": "cooked over strong direct heat",
    "happy": "feeling good or pleased",
    "huge": "very big in size",
    "hungry": "wanting or needing food",
    "latest": "newest or most recent",
    "lazy": "not wanting to work",
    "leather": "made from animal skin",
    "light": "not heavy in weight",
    "local": "from the place near you",
    "loud": "easy to hear because of strong sound",
    "lucky": "having good things happen by chance",
    "mad": "feeling very angry",
    "married": "having a husband or wife",
    "metal": "made of metal",
    "missing": "not where it should be",
    "Olympic": "connected with the Olympic Games",
    "online": "connected to the internet",
    "outdoor": "done or used outside",
    "pale": "having very little colour",
    "plastic": "made of plastic",
    "pleasant": "nice and enjoyable",
    "pleased": "happy about something",
    "relaxing": "helping you feel calm",
    "right hand": "the hand on your right side",
    "round": "shaped like a circle or ball",
    "same": "not different from another",
    "scary": "making someone feel afraid",
    "second": "coming after the first",
    "sick": "ill or not well",
    "simple": "easy to understand or do",
    "single": "only one, not more",
    "slim": "thin in an attractive way",
    "slow": "not moving or happening quickly",
    "small": "not big in size",
    "square": "having four equal straight sides",
    "striped": "having long lines of colour",
    "successful": "getting the result you wanted",
    "sunny": "with bright light from the sun",
    "surprised": "feeling wonder at something new",
    "terrible": "very bad or unpleasant",
    "thin": "not thick or not fat",
    "tired": "needing rest or sleep",
    "total": "including all parts",
    "upset": "very sad, worried, or angry",
    "useful": "helping you do something",
    "usual": "happening most of the time",
    "various": "several different kinds",
    "welcome": "wanted and gladly accepted",
    "well": "in a good way",
    "whole": "complete, with no part missing",
    "wonderful": "very good and enjoyable",
    "wooden": "made of wood",
    "block": "a group of buildings between city streets",
    "bring": "to carry something to a place",
    "check": "to look closely to make sure",
    "closed": "not open at this time",
    "clothes": "things people wear on their bodies",
    "complete": "to finish doing or making something",
    "dangerous": "likely to hurt someone",
    "east": "the direction where the sun rises",
    "engineer": "a person who designs or builds machines",
    "explore": "to travel around and learn about a place",
    "few": "a small number, not many",
    "fill": "to make something full",
    "final": "coming at the end",
    "flight": "a journey through the air",
    "frightened": "feeling afraid or scared",
    "frog": "a small animal that jumps and likes water",
    "granddaughter": "the daughter of your son or daughter",
    "grandmother": "the mother of your father or mother",
    "grandparent": "the parent of your father or mother",
    "grandson": "the son of your son or daughter",
    "harbour": "safe water where boats can stay",
    "herself": "the same female person already named",
    "himself": "the same male person already named",
    "horror": "a strong feeling of fear",
    "itself": "the same thing already named",
    "kind": "nice and caring, or a type",
    "lose": "to no longer have or find something",
    "low": "not high in place, amount, or sound",
    "luck": "good or bad things happening by chance",
    "milk": "a white drink from cows or other animals",
    "mistake": "something done or understood wrongly",
    "ourselves": "the same people meant by we",
    "pass": "to go past, or succeed in a test",
    "pharmacy": "a shop that sells medicine",
    "drugstore": "a shop that sells medicine",
    "photo(graph)": "a picture taken with a camera",
    "plant": "a living thing that grows in soil",
    "print": "to put words or pictures onto paper",
    "pupil": "a child who studies at school",
    "quiet": "making little or no sound",
    "relax (become happy)": "to rest and stop worrying",
    "seem": "to look or sound like something is true",
    "serious": "important, or not joking",
    "size": "how big or small something is",
    "snowboard": "a board used for riding on snow",
    "sound": "to seem when heard",
    "space": "an empty area or room",
    "stomach": "the body part where food goes",
    "such": "of this or that kind",
    "sure": "certain that something is true",
    "washing-up": "plates and cups that need washing",
    "worried": "feeling that something bad may happen",
    "worry": "to feel that something bad may happen",
    "camera": "a thing used for taking pictures",
    "cartoon": "a funny drawing or animated film",
    "deliver": "to take something to a person or place",
    "nurse": "a person who cares for sick people",
    "on": "in a position above and touching",
    "pink": "having the colour pink",
    "purple": "having the colour purple",
    "steal": "to take something that is not yours",
    "use": "to do something with a tool or object",
    "continue": "to keep going without stopping",
    "drink": "something liquid that you swallow",
    "enjoy": "to get pleasure from something",
    "exercise": "a task for learning or getting fit",
    "glove": "clothing worn over your hand",
    "hope": "to want something good to happen",
    "improve": "to become or make something better",
    "matter": "to be important",
    "practise": "to do something again to get better",
    "push": "to move something away with your hands",
    "repair": "to make something broken work again",
    "shall": "used to ask what we should do",
    "shut": "to close a door or window",
    "sometimes": "on some days but not always",
    "machine": "a thing with moving parts that does work",
    "printer": "a machine that prints words and pictures",
    "scooter": "a small vehicle with two wheels",
    "beautiful": "very nice to look at",
    "bother": "to annoy or cause trouble",
    "dad": "a simple word for father",
    "different": "not the same as another",
    "father": "a male parent",
    "gold": "a valuable yellow metal",
    "her": "the female person already mentioned",
    "interested": "wanting to know or learn more",
    "job": "work you do for money",
    "juice": "liquid from fruit or vegetables",
    "just": "a short time ago, or only",
    "keyboard": "keys used for typing or making music",
    "leather": "animal skin used to make things",
    "lunchtime": "the time when people eat lunch",
    "money": "coins and notes used for buying things",
    "myself": "the same person meant by I",
    "name": "a word used to call someone or something",
    "necklace": "jewellery worn around the neck",
    "noon": "twelve o'clock in the day",
    "office": "a place where people work at desks",
    "pack": "to put things into a bag or box",
    "pay": "to give money for something",
    "physics": "the study of how things move and work",
    "puzzle": "a game or problem you try to solve",
    "queen": "a female ruler or a king's wife",
    "quick": "taking very little time",
    "rabbit": "a small animal with long ears",
    "ready": "prepared to do something",
    "ski": "to move over snow on skis",
    "spider": "a small animal with eight legs",
    "swimsuit": "clothes worn for swimming",
    "table": "furniture with a flat top and legs",
    "this": "the thing or person near you",
    "umbrella": "a thing that keeps rain off you",
    "understand": "to know what something means",
    "university": "a place for study after school",
    "usually": "on most days or at most times",
    "v/versus": "used between two people or teams competing",
    "vegetable": "a plant part eaten as food",
    "visit": "to go and spend time with someone",
    "wait": "to stay until something happens",
    "way": "a method, direction, or path",
    "yellow": "having the colour yellow",
    "yet": "until now or by now",
    "young": "not old in age",
    "yourself": "the same person meant by you",
    "zero": "the number that means none",
    "zoo": "a park where people can see animals",
    "badminton": "a racket sport with a light ball",
    "bag": "a soft container used for carrying things",
    "battery": "a thing that gives power to machines",
    "best": "better than all the others",
    "better": "more good or more suitable",
    "bike": "a bicycle or motorcycle",
    "bin": "a container for rubbish",
    "blackboard": "a dark board used for writing in class",
    "boil": "to cook liquid until it bubbles",
    "boring": "making you lose interest",
    "bottle": "a container for liquids",
    "boyfriend": "a boy or man you love",
    "busy": "having a lot to do",
    "cafeteria": "a place where people choose and buy food",
    "calendar": "a page showing days, weeks, and months",
    "call": "to speak to someone by phone",
    "camping": "living in a tent for a short time",
    "car": "a small road vehicle with four wheels",
    "card": "a small piece of thick paper",
    "case": "a container that holds or protects something",
    "centimetre/centimeter (cm)": "a hundredth of a metre",
    "character": "the way a person thinks and behaves",
    "chemist": "a person who works in a medicine shop",
    "circus": "a show with funny or skilful acts",
    "classroom": "a room where students learn",
    "cloud": "a white or grey shape in the sky",
    "competition": "an event where people try to win",
    "concert": "a show of live music",
    "country": "an area of land with its own people",
    "crossing": "a place where roads or paths cross",
    "cup": "a small round container for drinks",
    "cupboard": "furniture with doors and shelves",
    "date": "a particular day in a month or year",
    "decide": "to choose what to do",
    "dentist": "a person who cares for people's teeth",
    "discount": "money taken off the usual price",
    "dish": "food prepared in a particular way",
    "do": "to perform an action or task",
    "drive": "to control a moving vehicle",
    "except": "not including one person or thing",
    "excited": "very happy and full of energy",
    "February": "the second month of the year",
    "festival": "a special day or time of celebration",
    "film": "moving pictures that tell a story",
    "food": "things people or animals eat",
    "foreign": "from a different country",
    "fridge": "a cold cupboard that keeps food fresh",
    "full": "holding as much as possible",
    "funny": "making people laugh",
    "good-looking": "nice to look at",
    "grandchild": "the child of your son or daughter",
    "his": "belonging to a male person",
    "internet": "a worldwide network of computers",
    "jump": "to push yourself off the ground",
    "kilometre (km)": "a unit for measuring long distance",
    "later": "after now or after another time",
    "least": "the smallest amount or number",
    "left": "the side opposite right",
    "lift": "to raise something to a higher place",
    "listen (to)": "to pay attention to sounds",
    "litre": "a unit for measuring liquids",
    "magazine": "a thin book published every week or month",
    "make-up": "coloured things put on the face",
    "manager": "a person who controls a business or team",
    "member": "a person belonging to a group",
    "microphone": "a thing that makes your voice louder",
    "mile": "a unit for measuring long distance",
    "mind": "to dislike or be troubled by something",
    "Miss": "a title used before a girl's name",
    "Mr": "a title used before a man's name",
    "Mrs": "a title used before a married woman's name",
    "Ms": "a title used before a woman's name",
    "music": "sounds made in a pleasing way",
    "nobody": "not any person",
    "north": "the direction at the top of a map",
    "nothing": "not anything at all",
    "off": "away from or not on",
    "onion": "a round vegetable with many layers",
    "photography": "the art of taking pictures",
    "platform": "a raised place where people stand",
    "police": "people whose job is keeping others safe",
    "project": "a piece of work done over time",
    "racket": "a tool used to hit balls in tennis",
    "radio": "a machine for listening to programmes",
    "raincoat": "a coat that keeps rain off you",
    "reading": "looking at and understanding written words",
    "recipe": "instructions for making food",
    "review": "an opinion about a book, film, or product",
    "right": "the side opposite left",
    "rock": "a hard natural material from the ground",
    "salad": "food made from uncooked vegetables",
    "season": "one of the four parts of a year",
    "set": "a group of things that belong together",
    "shy": "nervous with other people",
    "since": "from a past time until now",
    "sink": "a container used for washing things",
    "smart (stylish)": "neat and nice in appearance",
    "smart (clever)": "quick to learn and understand",
    "smoke": "a grey gas from something burning",
    "snow": "soft white ice that falls from the sky",
    "something": "a thing not named or known",
    "south": "the direction opposite north",
    "staff": "people who work for a business",
    "stand": "to be upright on your feet",
    "start": "the beginning of something",
    "straight": "without bending or turning",
    "subject": "something studied at school",
    "suggest": "to give an idea for someone to consider",
    "supermarket": "a large shop that sells food and goods",
    "surf": "to ride waves on a surfboard",
    "surfing": "riding waves on a surfboard",
    "surprise": "something unexpected that causes wonder",
    "swan": "a large white bird with a long neck",
    "swimming": "moving through water with your body",
    "tasty": "having a very good taste",
    "theirs": "belonging to those people",
    "tidy": "clean and in the right place",
    "together": "with another person or thing",
    "toothache": "pain in or near a tooth",
    "toothbrush": "a small brush used to clean teeth",
    "train (transitive and intransitive)": "to teach or practise a skill",
    "training (transitive and intransitive)": "learning and practising a skill",
    "trouble": "problems or difficult situations",
    "turn": "to change direction",
    "unhappy": "sad or not happy",
    "very": "used to make a meaning stronger",
    "video": "moving pictures with sound",
    "warm": "a little hot, but comfortable",
    "west": "the direction where the sun sets",
    "where": "used to ask about a place",
    "which": "used to ask about a choice",
    "windsurfing": "riding water on a board with a sail",
    "winner": "a person who wins",
    "word": "a group of letters with meaning",
    "worse": "less good than another",
    "worst": "less good than all others",
    "cold": "having a low amount of heat",
    "cool": "a little cold, but pleasant",
    "cycle": "to travel on a bicycle",
    "date": "one day in a month or year",
    "each": "every one of two or more things",
    "gift": "something you give to another person",
    "grandpa": "a simple word for grandfather",
    "granny": "a simple word for grandmother",
    "he": "a male person already talked about",
    "or": "used to show another choice",
    "pain": "a strong feeling of hurt",
    "she": "a female person already talked about",
    "until": "up to a certain time",
    "warm": "a little hot, but not too hot",
    "Yeah!": "used to show joy",
    "everybody": "all the people",
    "everyone": "every single person",
    "per": "for each person or thing",
    "speak": "to say words using your voice",
    "wow": "used to show great surprise or pleasure",
    "your": "belonging to the person being spoken to",
}

DEFINITION_OVERRIDES.update({
    "actually": "in fact or really",
    "also": "in addition or too",
    "and": "joins words or ideas together",
    "as well (as)": "and another thing too",
    "available": "ready to use or buy",
    "band": "a group that plays music",
    "bat": "a stick used to hit a ball",
    "because": "for the reason that",
    "beside": "next to a person or thing",
    "blood": "red liquid that moves through the body",
    "boat": "a small vehicle used on water",
    "bus": "a large road vehicle for passengers",
    "but": "joins two different ideas",
    "by": "near or next to something",
    "careful": "trying not to make a mistake",
    "castle": "a large strong old building",
    "celebrate": "to do something for a happy event",
    "come": "to move towards this place",
    "conversation": "people talking together",
    "cook": "to make food using heat",
    "cooker": "a machine used to cook food",
    "could": "may be able to do something",
    "delay": "to make something happen later",
    "else": "another person or thing",
    "equipment": "things used for a job or activity",
    "eraser": "a thing that removes pencil marks",
    "especially": "more than the others",
    "even": "used for something surprising",
    "exactly": "completely right with no difference",
    "for": "meant to help or be given to",
    "get": "to receive, reach, or become",
    "goal": "something you want to do",
    "grade": "a letter or number for school work",
    "grandfather": "your mother's or father's father",
    "ground": "the land under your feet",
    "how": "asks about the way something happens",
    "however": "but at the start of a new sentence",
    "if": "when something may happen",
    "in": "inside a place, area, or time",
    "including": "with this as one part",
    "instead of": "in the place of something else",
    "library": "a place where you can read books",
    "look": "to turn your eyes towards something",
    "many": "a large number of things",
    "may": "can happen or is allowed",
    "mean": "to say or show an idea",
    "might": "may possibly happen",
    "most": "the largest number or amount",
    "much": "a large amount of something",
    "must": "have to do something",
    "no": "a word for refusing or disagreeing",
    "now": "at this time, not later",
    "number": "a sign that shows an amount",
    "of": "belonging or connected to something",
    "OK/okay": "yes, it is fine",
    "pardon": "please say that again",
    "parent": "a mother or father",
    "pillow": "a soft thing for your head",
    "plane": "a vehicle with wings that flies",
    "please": "used when asking politely",
    "plus": "added to another number",
    "p.m.": "after midday and before midnight",
    "possibly": "maybe, it could happen",
    "post office": "a place that sends and receives mail",
    "pull": "to move something towards you",
    "salt": "a white powder used in food",
    "score": "points in a game or test",
    "shame": "a sad feeling after doing wrong",
    "should": "says what is right or helpful",
    "sky": "the space we see above us",
    "snack": "a small amount of food",
    "some": "an amount or number, but not all",
    "spelling": "the letters used to write a word",
    "suppose": "to think something may be true",
    "taxi": "a car that takes paying passengers",
    "teenager": "a person aged thirteen to nineteen",
    "telephone": "a machine for talking to faraway people",
    "than": "used when comparing two things",
    "that": "points to a person, thing, or idea",
    "themselves": "the same people already named",
    "there": "in or at that place",
    "toilet": "a bathroom seat for body waste",
    "unfortunately": "used when something bad happens",
    "us": "the speaker and other people",
    "with": "together with another person or thing",
    "without": "not having someone or something",
    "would": "used for wishes or polite requests",
    "who": "asks about a person",
    "will ('ll)": "shows what happens in the future",
    "train": "a long vehicle that runs on rails",
    "tram": "a street vehicle that runs on rails",
})

PERSON_HEADWORDS = {
    "actor", "artist", "baby", "boy", "boyfriend", "boss", "brother",
    "business person", "businessman", "businesswoman", "celebrity", "chemist",
    "child", "cleaner", "clown", "coach", "colleague", "comic", "cook",
    "cousin", "customer", "dad", "daughter", "dentist", "doctor", "driver",
    "engineer", "explorer", "farmer", "father", "football player", "footballer",
    "friend", "girl", "grandchild", "granddaughter", "grandfather", "grandma",
    "grandmother", "grandpa", "grandparent", "grandson", "granny", "guest",
    "guide", "headteacher", "housewife", "husband", "journalist", "kid", "kids",
    "king", "manager", "mechanic", "mom", "mother", "musician", "nurse",
    "painter", "parent", "passenger", "penfriend", "photographer", "pilot",
    "player", "police officer", "queen", "receptionist", "schoolchild", "scientist",
    "secretary", "shop assistant", "shopper", "singer", "sister", "son", "student",
    "teacher", "tennis player", "tour guide", "trainer", "visitor", "waiter",
    "waitress", "wife", "winner", "worker", "writer",
}

SPORTS_NO_ARTICLE = {
    "badminton", "baseball", "basketball", "football", "golf", "hockey",
    "rugby", "soccer", "table tennis", "tennis", "volleyball",
}

ACTIVITY_HEADWORDS = {
    "camping", "climbing", "cooking", "cycling", "dancing", "diving", "fishing",
    "photography", "riding", "running", "sailing", "shopping", "sightseeing",
    "singing", "skateboarding", "skating", "skiing", "snowboarding", "surfing",
    "swimming", "walking", "windsurfing", "writing",
}

COLOUR_HEADWORDS = {"black", "blue", "brown", "golden", "green", "grey", "orange", "pink", "purple", "red", "white", "yellow"}
WEATHER_ADJECTIVES = {"cloudy", "cold", "foggy", "hot", "sunny", "wet", "windy"}
FEELING_ADJECTIVES = {"bored", "happy", "hungry", "ill", "lucky", "mad", "pleased", "sad", "sick", "surprised", "tired", "upset", "well"}
FOOD_ADJECTIVES = {"boiled", "delicious", "grilled", "sweet"}
MATERIAL_HEADWORDS = {"glass", "leather", "metal", "plastic"}

MISSING_GLOSSES = {
    "alarm clock": ["闹钟"],
    "all kinds of": ["各种"],
    "all right/alright": ["没事", "好的"],
    "all sorts of": ["各种"],
    "all the time": ["一直"],
    "apartment building": ["公寓楼"],
    "app": ["应用软件"],
    "as well": ["也"],
    "as well (as)": ["也", "还有"],
    "at all": ["根本", "一点儿"],
    "bathing suit": ["泳衣"],
    "because of": ["因为"],
    "board game": ["桌游"],
    "break down": ["坏了", "出故障"],
    "bring back": ["带回来"],
    "business person": ["生意人"],
    "bus station": ["汽车站"],
    "bus stop": ["公交站"],
    "by accident": ["不小心"],
    "by the way": ["顺便说"],
    "by post": ["邮寄"],
    "car park": ["停车场"],
    "CD player": ["CD机"],
    "cell phone": ["手机"],
    "chatroom": ["聊天室"],
    "city centre": ["市中心"],
    "close to": ["靠近"],
    "come back": ["回来"],
    "credit card": ["信用卡"],
    "department store": ["百货商店"],
    "digital camera": ["数码相机"],
    "dining room": ["餐厅"],
    "Dr": ["医生"],
    "DVD player": ["DVD播放器"],
    "each other": ["互相"],
    "fall over": ["摔倒"],
    "fast food": ["快餐"],
    "fill in": ["填写"],
    "find out": ["弄清楚"],
    "first name": ["名字"],
    "first of all": ["首先"],
    "football player": ["足球运动员"],
    "for sale": ["出售"],
    "French fries": ["薯条"],
    "gas station": ["加油站"],
    "get back": ["回来"],
    "get dressed": ["穿好衣服"],
    "get fit": ["变强壮"],
    "get married": ["结婚"],
    "get off": ["下车"],
    "get on": ["上车"],
    "get up": ["起床"],
    "give back": ["归还"],
    "good afternoon": ["下午好"],
    "good evening": ["晚上好"],
    "good morning": ["早上好"],
    "good night": ["晚安"],
    "go out": ["出去"],
    "grocery store": ["食品店"],
    "grow up": ["长大"],
    "Guess what?": ["你猜"],
    "guest-house": ["小旅馆"],
    "have got to": ["必须"],
    "have to": ["必须"],
    "headteacher": ["校长"],
    "ice cream": ["冰淇淋"],
    "ice skating": ["滑冰"],
    "ID card": ["身份证"],
    "in front of": ["在前面"],
    "instead of": ["而不是"],
    "lie down": ["躺下"],
    "living room": ["客厅"],
    "look after": ["照顾"],
    "look at": ["看"],
    "look for": ["寻找"],
    "look out": ["当心"],
    "main course": ["主菜"],
    "make sure (that)": ["确保"],
    "mineral water": ["矿泉水"],
    "movie star": ["电影明星"],
    "movie theater": ["电影院"],
    "next to": ["紧挨着"],
    "no one": ["没有人"],
    "of course": ["当然"],
    "oh dear!": ["哎呀"],
    "out of": ["从里面"],
    "parking lot": ["停车场"],
    "pencil case": ["铅笔盒"],
    "penfriend": ["笔友"],
    "petrol station": ["加油站"],
    "pick up": ["捡起", "接人"],
    "polar bear": ["北极熊"],
    "police car": ["警车"],
    "police officer": ["警察"],
    "police station": ["警察局"],
    "put on": ["穿上"],
    "right hand": ["右手"],
    "shop assistant": ["店员"],
    "shopping centre": ["购物中心"],
    "sit down": ["坐下"],
    "sitting room": ["客厅"],
    "social media": ["社交媒体"],
    "sports centre": ["体育中心"],
    "stomach ache": ["肚子疼"],
    "swimming costume": ["泳衣"],
    "swimming pool": ["游泳池"],
    "table tennis": ["乒乓球"],
    "take off": ["脱下", "起飞"],
    "take part": ["参加"],
    "tennis player": ["网球运动员"],
    "text message": ["短信"],
    "thank you": ["谢谢"],
    "theirs": ["他们的"],
    "tidy up": ["收拾好"],
    "tour guide": ["导游"],
    "tourist information centre": ["游客中心"],
    "traffic light": ["红绿灯"],
    "try on": ["试穿"],
    "turn off": ["关掉"],
    "turn on": ["打开"],
    "video game": ["电子游戏"],
    "wake up": ["醒来"],
    "washing machine": ["洗衣机"],
    "wash up": ["洗碗"],
    "web page": ["网页"],
    "well known": ["有名的"],
    "work out": ["锻炼"],
    "working hours": ["工作时间"],
    "write down": ["写下"],
    "burger": ["汉堡包"],
    "download": ["下载"],
    "DVD": ["影碟"],
    "euro": ["欧元"],
    "goodbye": ["再见"],
    "hey": ["嘿"],
    "hi": ["你好"],
    "internet": ["互联网"],
    "laptop (computer)": ["笔记本电脑"],
    "oh": ["哦"],
    "online": ["在线"],
    "rainforest": ["雨林"],
    "teenager": ["青少年"],
    "upload": ["上传"],
    "v/versus": ["对", "对抗"],
    "website": ["网站"],
    "wow": ["哇"],
    "gallery": ["画廊"],
    "gym": ["体育馆"],
    "hip hop": ["嘻哈"],
    "just": ["只是", "刚刚"],
    "matter": ["要紧"],
    "pack": ["收拾行李"],
    "pay": ["付款"],
    "physics": ["物理"],
    "ready": ["准备好"],
    "share": ["分享"],
    "ski": ["滑雪"],
    "upset": ["难过的"],
    "Yeah!": ["耶"],
}

SIMPLE_REPLACEMENTS = {
    "automobile": "car",
    "purchase": "buy",
    "residence": "home",
    "individual": "person",
    "persons": "people",
    "someone": "a person",
    "somebody": "a person",
    "something": "a thing",
    "children": "young people",
    "commence": "start",
    "terminate": "end",
    "obtain": "get",
    "depart": "leave",
    "arrive at": "reach",
    "utilize": "use",
    "possess": "have",
    "consume": "eat or drink",
    "dwelling": "home",
    "garment": "clothes",
    "physician": "doctor",
    "occupation": "job",
    "vehicle": "car or bus",
    "facility": "place",
    "location": "place",
    "approximately": "about",
    "immediately": "now",
    "frequently": "often",
    "inexpensive": "cheap",
    "difficult": "hard",
    "rapidly": "quickly",
    "wild animals are housed for exhibition": "wild animals live for people to see",
    "for exhibition": "for people to see",
    "performing calculations automatically": "working with numbers by itself",
    "identifies": "shows",
    "identify": "show",
    "allows": "lets",
    "allow": "let",
    "organize": "sort",
    "organise": "sort",
    "rear": "back",
    "endure": "continue",
    "computation": "work with numbers",
    "computations": "work with numbers",
    "beverage": "drink",
    "edible": "safe to eat",
    "select": "choose",
    "receive": "get",
    "require": "need",
    "requires": "needs",
    "contains": "has",
    "containing": "with",
    "located": "found",
    "construct": "build",
    "constructed": "built",
    "commonly": "often",
    "usually": "often",
    "similar": "like it",
    "specific": "one special",
    "certain": "some",
    "entire": "whole",
    "mainly": "mostly",
    "especially": "mostly",
    "instrument": "tool",
    "device": "thing",
    "equipment": "things you use",
    "material": "what a thing is made from",
    "surface": "outside part",
    "method": "way",
    "purpose": "reason",
    "activity": "thing you do",
    "profession": "job",
    "employed": "working",
    "communicate": "talk",
    "communication": "talking",
    "conversation": "talk",
    "information": "facts",
    "approximately": "about",
    "opposite": "across from",
}

EXAMPLE_OVERRIDES = {
    "because": "I stayed home because it rained.",
    "before": "Wash your hands before lunch.",
    "but": "I am tired, but happy.",
    "either": "You can choose either book.",
    "if": "Call me if you need help.",
    "or": "Would you like tea or juice?",
    "since": "I have lived here since May.",
    "so": "It rained, so we stayed home.",
    "than": "My bag is bigger than yours.",
    "that": "I know that she is kind.",
    "though": "It was cold, though we played.",
    "until": "Wait here until I come back.",
    "when": "Smile when you see the camera.",
    "while": "I read while Mum cooked.",
    "be": "Please be kind to your friend.",
    "do": "I do my homework after school.",
    "have": "I have a little blue bike.",
    "may": "You may sit beside me.",
    "might": "It might rain after lunch.",
    "must": "You must wear your seat belt.",
    "shall": "Shall we play outside now?",
    "should": "You should drink more water.",
    "will": "I will help you today.",
    "would": "I would like some juice.",
    "bye": "Bye! See you tomorrow morning.",
    "good afternoon": "Good afternoon, Mrs Green!",
    "good evening": "Good evening, Dad. Dinner is ready.",
    "good morning": "Good morning, everyone! Time for school.",
    "good night": "Good night! Sleep well.",
    "goodbye": "Goodbye! See you tomorrow.",
    "hello": "Hello! My name is Ben.",
    "hey": "Hey! Wait for me!",
    "hi": "Hi! Can I sit here?",
    "congratulations!": "Congratulations! You did very well.",
    "coffee": "Would you like coffee or tea?",
    "correct": "Your answer is correct.",
    "cousin": "My cousin plays football with me.",
    "dear": "Dear Ben, thank you for writing.",
    "Guess what?": "Guess what? I found my ball!",
    "hip hop": "My sister loves hip hop.",
    "January": "My birthday is in January.",
    "last": "I was the last child in line.",
    "mark": "The teacher gave me a good mark.",
    "mile": "The school is one mile away.",
    "minute": "Wait one minute, please.",
    "mirror": "I can see my face in the mirror.",
    "newspaper": "Dad reads the newspaper every morning.",
    "oh dear!": "Oh dear! My ice cream fell.",
    "passport": "I showed my passport at the airport.",
    "pet": "My pet sleeps beside my bed.",
    "quiz": "We had a quiz at school.",
    "rich": "The rich man gave us food.",
    "ruler": "Use a ruler to draw this line.",
    "score": "Our team got the highest score.",
    "soup": "The soup is hot.",
    "strawberry": "The strawberry is red and sweet.",
    "sweet": "This apple tastes sweet.",
    "thank you": "Thank you for helping me.",
    "time": "What time does school start?",
    "try on": "May I try on this coat?",
    "view": "The window has a lovely view.",
    "weekly": "Our class meets weekly.",
    "wood": "This table is made of wood.",
    "badly": "The test went badly.",
    "below": "Read the words below.",
    "board game": "We played a board game.",
    "bring back": "Please bring the book back.",
    "certainly": "I will certainly help you.",
    "easily": "She can read this easily.",
    "even": "Even Dad likes this game.",
    "everybody": "Everybody is ready for lunch.",
    "everyone": "Everyone came to my party.",
    "everything": "Everything is in the box.",
    "exactly": "That is exactly what I mean.",
    "fall over": "The little boy may fall over.",
    "fill in": "Please fill in your name.",
    "finally": "We finally reached the zoo.",
    "find out": "Let us find out together.",
    "get dressed": "I get dressed before breakfast.",
    "get fit": "I swim to get fit.",
    "get married": "They will get married in June.",
    "get off": "We get off at school.",
    "get on": "Please get on the bus.",
    "get up": "I get up at seven.",
    "give somebody a call/ring": "Please give Grandma a call.",
    "go out": "We go out after dinner.",
    "grow up": "I want to grow up here.",
    "he": "He is my best friend.",
    "him": "I gave him the book.",
    "home": "I went home after school.",
    "however": "It was cold. However, we played.",
    "I": "I like my new school.",
    "immediately": "Come here immediately, please.",
    "in": "The toys are in the box.",
    "it": "It is under the table.",
    "IT": "We use IT at school.",
    "least": "This bag costs the least.",
    "lie down": "Please lie down on the bed.",
    "look after": "I look after my little brother.",
    "look at": "Look at the red kite.",
    "look for": "I am looking for my shoe.",
    "luckily": "Luckily, no one was hurt.",
    "make sure (that)": "Please make sure the door is shut.",
    "May": "My birthday is in May.",
    "me": "Please wait for me.",
    "nearly": "It is nearly time for lunch.",
    "never": "I never drink coffee at night.",
    "no": "No, I do not want cake.",
    "no one": "No one was in the room.",
    "o'clock": "School starts at eight o'clock.",
    "on": "The book is on the desk.",
    "ours": "The blue car is ours.",
    "outdoors": "We played outdoors after lunch.",
    "p.m.": "School ends at four p.m.",
    "pick up": "Please pick up your pencil.",
    "probably": "It will probably rain today.",
    "put on": "Please put on your coat.",
    "quickly": "Please walk quickly to class.",
    "recently": "I recently read that book.",
    "she": "She sits next to me.",
    "sit down": "Please sit down beside me.",
    "slowly": "Please speak slowly for me.",
    "somebody": "Somebody is at the door.",
    "still": "Mum is still at work.",
    "suddenly": "The lights suddenly went out.",
    "take part": "I want to take part.",
    "their": "Their house is near school.",
    "them": "I can see them outside.",
    "they": "They are in the garden.",
    "tidy up": "Please tidy up your room.",
    "up": "Look up at the sky.",
    "upstairs": "My bedroom is upstairs.",
    "us": "Mum made lunch for us.",
    "usually": "I usually walk to school.",
    "video game": "We played a video game.",
    "visit": "We visit Grandma every Sunday.",
    "wake up": "I wake up at seven.",
    "wash up": "We wash up after dinner.",
    "we": "We walk to school together.",
    "work out": "Dad and I work out together.",
    "write down": "Please write down your name.",
    "your": "Your bag is on the chair.",
    "clothes": "My clothes are in the cupboard.",
    "contact": "Please keep in contact with me.",
    "danger": "The sign tells us about danger.",
    "environment": "We must care for the environment.",
    "euro": "This toy costs one euro.",
    "fact": "This fact is true.",
    "fire": "The fire kept us warm.",
    "first name": "My first name is Ben.",
    "fog": "The road was hidden by fog.",
    "for sale": "This old bike is for sale.",
    "furniture": "The room has new furniture.",
    "geography": "We learn about maps in geography.",
    "health": "Walking is good for your health.",
    "horror": "I do not like horror films.",
    "identification": "Show your identification at the door.",
    "itself": "The door closed by itself.",
    "jewellery": "Mum keeps her jewellery in a box.",
    "language": "English is a useful language.",
    "luck": "We had good luck today.",
    "luggage": "Our luggage is in the car.",
    "medicine": "Take your medicine after lunch.",
    "menu": "I read the menu before ordering.",
    "model": "Ben built a model plane.",
    "pupil": "The pupil raised her hand.",
    "pack": "Please pack your blue shirt.",
    "pay": "Please pay for the book.",
    "social media": "Mum shared a photo on social media.",
    "washing-up": "I do the washing-up after dinner.",
    "continue": "Please continue reading the story.",
    "enjoy": "We enjoy music at home.",
    "hope": "I hope you feel better soon.",
    "improve": "Reading will improve your English.",
    "repair": "Dad can repair my bike.",
    "shut": "Please shut the door.",
    "machine": "This machine washes our clothes.",
    "printer": "The printer is beside the computer.",
    "scooter": "Ben rides his scooter to school.",
    "dad": "My dad reads with me.",
    "each": "Each child has a book.",
    "father": "My father cooks dinner on Fridays.",
    "gold": "Mum wears a gold ring.",
    "hair": "Her hair is long and brown.",
    "jazz": "Dad plays jazz at home.",
    "job": "Mum has a new job.",
    "keyboard": "I play songs on the keyboard.",
    "leather": "This belt is made of leather.",
    "myself": "I made this card myself.",
    "name": "My name is Jack.",
    "physics": "We learn about light in physics.",
    "puzzle": "I finished the puzzle after lunch.",
    "queen": "The queen wore a gold crown.",
    "quick": "Ben gave a quick answer.",
    "ski": "We ski on the snow.",
    "spider": "The spider has eight legs.",
    "swimsuit": "My swimsuit is blue and white.",
    "university": "My sister studies at university.",
    "vegetable": "I eat a green vegetable.",
    "wait": "Wait here until I return.",
    "yellow": "The yellow car moves fast.",
    "young": "My little brother is young.",
    "zero": "The answer is zero.",
    "best": "This is my best picture.",
    "better": "This one is better than that.",
    "February": "My birthday is in February.",
    "make-up": "Mum put on some make-up.",
    "set": "I have a set of crayons.",
    "staff": "The school staff are very kind.",
    "subject": "We studied a new subject today.",
    "together": "We walked home together.",
    "worse": "This is worse than before.",
    "worst": "That was the worst day.",
    "cheap": "This little toy was cheap.",
    "classical": "We listened to classical music.",
    "clever": "That clever girl solved the puzzle.",
    "close": "My school is close to home.",
    "comfortable": "This chair is very comfortable.",
    "crowded": "The bus is crowded today.",
    "dead": "The little plant is dead.",
    "deep": "The water is very deep.",
    "digital": "Dad has a digital camera.",
    "electric": "We have an electric car.",
    "excellent": "Your picture is excellent.",
    "expensive": "This bike is too expensive.",
    "extinct": "Dinosaurs are extinct now.",
    "fat": "The fat cat sat on the mat.",
    "friendly": "Our new teacher is friendly.",
    "fun": "The party was great fun.",
    "further": "The park is further away.",
    "half-price": "This coat is half-price today.",
    "hard": "This question is too hard.",
    "helpful": "Your notes were very helpful.",
    "huge": "They live in a huge house.",
    "lazy": "The lazy cat slept all day.",
    "latest": "This is the latest book.",
    "left-hand": "Use the left-hand door.",
    "light": "This bag is very light.",
    "local": "We buy food at the local shop.",
    "loud": "The music is too loud.",
    "married": "My parents are married.",
    "missing": "My red sock is missing.",
    "national": "It is a national holiday.",
    "Olympic": "She dreams of an Olympic medal.",
    "online": "Our class is online today.",
    "outdoor": "We have an outdoor swimming pool.",
    "pale": "Her face looked very pale.",
    "pleasant": "We had a pleasant walk.",
    "relaxing": "The music is quiet and relaxing.",
    "right hand": "Raise your right hand, please.",
    "round": "The table is round.",
    "same": "We have the same bag.",
    "scary": "That story was too scary.",
    "second": "Ben came second in the race.",
    "simple": "This game has simple rules.",
    "single": "I bought a single ticket.",
    "slim": "The slim boy runs fast.",
    "slow": "This old bus is slow.",
    "small": "The mouse is very small.",
    "square": "Draw a square on the paper.",
    "striped": "She wore a striped shirt.",
    "successful": "Our school show was successful.",
    "surprising": "The answer was very surprising.",
    "terrible": "The food was terrible.",
    "thin": "Cut the bread into thin pieces.",
    "total": "The total cost is ten pounds.",
    "useful": "This little book is useful.",
    "usual": "We met at the usual place.",
    "various": "We tried various games at school.",
    "welcome": "You are welcome in our home.",
    "well known": "That singer is well known.",
    "whole": "I ate the whole apple.",
    "wonderful": "We had a wonderful day.",
    "wow": "Wow! That kite is very high.",
    "Yeah!": "Yeah! Our team won today.",
}


def variants(headword: str) -> list[str]:
    base = headword.lower().replace("’", "'").strip("!?")
    values = [base, re.sub(r"\([^)]*\)", "", base).strip()]
    for value in list(values):
        values.extend(part.strip() for part in re.split(r"\s*/\s*", value) if part.strip())
    return list(dict.fromkeys(values))


def friendly_pos(raw: str) -> str:
    source = re.match(r"^\(([^)]+)\)", raw)
    value = source.group(1) if source else raw
    names = {
        "adj": "adjective", "adv": "adverb", "n": "noun", "v": "verb",
        "av": "auxiliary verb", "mv": "modal verb", "prep": "preposition",
        "prep phr": "prepositional phrase", "phr v": "phrasal verb",
        "pron": "pronoun", "det": "determiner", "conj": "conjunction",
        "exclam": "exclamation", "pl": "plural", "sing": "singular",
    }
    return " and ".join(names.get(part.strip(), part.strip()) for part in re.split(r"\s*(?:,|&)\s*", value))


def has_pos(value: str, name: str) -> bool:
    return re.search(rf"\b{re.escape(name)}\b", value.lower()) is not None


def official_sentence(examples: list[str]) -> str:
    candidates = []
    for value in examples:
        value = re.sub(
            r"\s+\((?:adj|adv|n|v|prep|ability|request|offer|possibility|permission)\)$",
            "",
            value,
            flags=re.I,
        ).strip()
        if re.match(r"^[A-Z0-9“'’]", value) and re.search(r"[.!?]$", value):
            candidates.append(value)
    return min(candidates, key=lambda value: len(value.split()), default="")


def dictionary_row(entry: dict, dictionary: dict[str, dict]) -> dict:
    for value in variants(entry["headword"]):
        if value in dictionary:
            return dictionary[value]
    return {}


def load_simple_dictionary(path: Path) -> dict[str, list[dict]]:
    dictionary: dict[str, list[dict]] = defaultdict(list)
    if not path.exists():
        return dictionary
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            dictionary[row["word"].lower()].append(row)
    return dictionary


def simple_dictionary_rows(entry: dict, dictionary: dict[str, list[dict]]) -> list[dict]:
    values = []
    for value in variants(entry["headword"]):
        values.extend([value, value.replace("-", " "), value.replace(" ", "-")])
    rows = []
    seen = set()
    for value in values:
        for row in dictionary.get(value, []):
            key = (row.get("word"), row.get("pos"), json.dumps(row.get("senses", []), sort_keys=True))
            if key not in seen:
                seen.add(key)
                rows.append(row)
    return rows


def simple_pos_targets(entry: dict) -> set[str]:
    pos = friendly_pos(entry["partOfSpeechOfficial"]).lower()
    targets = set()
    mapping = {
        "noun": "noun", "verb": "verb", "adjective": "adj", "adverb": "adv",
        "preposition": "prep", "pronoun": "pron", "determiner": "det",
        "conjunction": "conj", "exclamation": "intj",
    }
    for long_name, short_name in mapping.items():
        if has_pos(pos, long_name):
            targets.add(short_name)
    return targets


def choose_simple_sense(entry: dict, dictionary: dict[str, list[dict]]) -> tuple[str, list[str]]:
    targets = simple_pos_targets(entry)
    example_words = set(re.findall(r"[a-z]+", " ".join(entry["officialExamples"]).lower()))
    label_words = set(re.findall(r"[a-z]+", " ".join(re.findall(r"\(([^)]*)\)", entry["headword"])).lower()))
    candidates = []
    for row_index, row in enumerate(simple_dictionary_rows(entry, dictionary)):
        pos_score = 9 if not targets or row.get("pos") in targets else 0
        for sense_index, sense in enumerate(row.get("senses", [])):
            glosses = sense.get("glosses") or []
            if not glosses:
                continue
            gloss = glosses[0].strip()
            gloss_words = set(re.findall(r"[a-z]+", gloss.lower()))
            score = pos_score
            if re.search(r"\b(?:present participle|past participle|past tense|another way (?:of|to) say|you use x)\b", gloss, re.I):
                score -= 24
            score += 5 * len(label_words & gloss_words)
            score += len(example_words & gloss_words)
            score -= sense_index * 0.35 + row_index * 0.05
            examples = [item.get("text", "").strip() for item in sense.get("examples", []) if item.get("text")]
            candidates.append((score, -len(gloss.split()), gloss, examples))
    if not candidates:
        return "", []
    _, _, gloss, examples = max(candidates)
    return gloss, examples


def apply_simple_replacements(value: str) -> str:
    for hard, easy in sorted(SIMPLE_REPLACEMENTS.items(), key=lambda item: len(item[0]), reverse=True):
        value = re.sub(rf"\b{re.escape(hard)}\b", easy, value, flags=re.I)
    return value


def shorten_simple_definition(entry: dict, gloss: str) -> str:
    if not gloss:
        return ""
    value = gloss.replace("“", '"').replace("”", '"').strip()
    value = re.sub(r"\[[^]]*\]", "", value)
    value = re.sub(r"\([^)]*\)", "", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    forms = sorted(variants(entry["headword"]), key=len, reverse=True)
    for form in forms:
        escaped = re.escape(form)
        framed = [
            rf"^(?:a|an|the)\s+{escaped}\s+(?:is|are)\s+",
            rf"^your\s+{escaped}\s+(?:is|are)\s+",
            rf"^{escaped}\s+(?:is|are|means?)\s+",
        ]
        for pattern in framed:
            updated = re.sub(pattern, "", value, count=1, flags=re.I)
            if updated != value:
                value = updated
                break

    conditional_patterns = [
        r"^if (?:a person|someone|somebody|you) [^,]+,\s*(?:a person|they|he|she|you)\s+",
        r"^if (?:a thing|something|it) (?:is|has) [^,]+,\s*(?:the thing|it)\s+",
        r"^when (?:a thing|something|it) (?:is|has) [^,]+,\s*(?:the thing|it)\s+",
    ]
    for pattern in conditional_patterns:
        updated = re.sub(pattern, "", value, count=1, flags=re.I)
        if updated != value:
            value = updated
            break

    conditional = re.match(r"^(?:if|when)\s+[^,]+,\s*(.+)$", value, flags=re.I)
    if conditional:
        value = conditional.group(1)
        value = re.sub(r"^(?:a person|the person|the thing|the first thing|it|they|he|she|you|x)\s+", "", value, flags=re.I)
        if has_pos(friendly_pos(entry["partOfSpeechOfficial"]), "verb") and not value.lower().startswith("to "):
            value = f"to {value}"

    value = re.sub(r"\bx\b", "one thing", value, flags=re.I)
    value = re.sub(r"\by\b", "another thing", value, flags=re.I)
    value = re.sub(r"\bz\b", "a third thing", value, flags=re.I)
    if value.lower().startswith("when ") and has_pos(friendly_pos(entry["partOfSpeechOfficial"]), "noun"):
        value = f"the time {value}"

    value = apply_simple_replacements(value)
    value = re.split(r"[.;]", value, maxsplit=1)[0].strip(" ,")
    if "," in value:
        first = value.split(",", 1)[0].strip()
        if len(first.split()) >= 3:
            value = first
    value = re.sub(r"^(?:it|they|he|she)\s+", "", value, flags=re.I)
    value = re.sub(r"\b(?:in order to)\b", "to", value, flags=re.I)
    value = re.sub(r"\s+", " ", value).strip(" ,.-")

    words = value.split()
    if len(words) > 8:
        for marker in (" that ", " which ", " who "):
            before = value.lower().find(marker)
            if before > 0:
                short = value[:before].strip()
                if 3 <= len(short.split()) <= 8:
                    value = short
                    words = value.split()
                    break
    if len(words) > 8:
        words = words[:8]
        while len(words) > 3 and words[-1].lower().strip(",") in {
            "a", "an", "the", "to", "of", "for", "with", "that", "which", "who",
            "and", "or", "in", "on", "at", "from", "by", "than", "as",
        }:
            words.pop()
        value = " ".join(words).strip(" ,.-")

    words = value.split()
    pos = friendly_pos(entry["partOfSpeechOfficial"]).lower()
    if len(words) == 2 and has_pos(pos, "adjective"):
        value = f"describes something {value}"
    elif len(words) == 2 and has_pos(pos, "verb") and not value.lower().startswith("to "):
        value = f"to {value}"
    elif len(words) == 2 and has_pos(pos, "noun"):
        value = f"a kind of {value}"
    elif len(words) < 3:
        return ""
    return value[:1].lower() + value[1:]


def simple_example(entry: dict, examples: list[str]) -> str:
    forms = variants(entry["headword"])
    roots = [re.sub(r"[^a-z]", "", form)[:5] for form in forms if re.sub(r"[^a-z]", "", form)]
    rejected = re.compile(r"\b(?:blood|dead|death|drunk|gun|hospital|kill|killed|naked|president|promotion|sex|slave|slaves|stupid|theory|weapon|wedding)\b", re.I)
    candidates = []
    for source in examples:
        value = re.sub(r"\s+", " ", source).strip()
        words = re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)?", value)
        if not 4 <= len(words) <= 9 or rejected.search(value) or re.search(r'[0-9#"()]', value):
            continue
        lower = re.sub(r"[^a-z]", "", value.lower())
        if roots and not any(root in lower for root in roots if len(root) >= 3):
            continue
        unfamiliar = sum(len(word) >= 9 and word.lower() not in entry["headword"].lower() for word in words)
        if unfamiliar:
            continue
        punctuation = value.count(",") + value.count(":") + value.count(";")
        candidates.append((unfamiliar, punctuation, len(words), value))
    if not candidates:
        return ""
    return min(candidates)[-1]


def chinese_glosses(entry: dict, row: dict) -> list[str]:
    if entry["headword"] in MISSING_GLOSSES:
        return MISSING_GLOSSES[entry["headword"]]
    text = row.get("translation", "").replace("\\n", "\n")
    first_line = next((line for line in text.splitlines() if not line.lstrip().startswith("[")), "")
    first_line = re.sub(r"^(?:n|v|a|s|adv|prep|conj|pron|vt|vi)\.\s*", "", first_line, flags=re.I)
    values = []
    for value in re.split(r"[,，;；]", first_line):
        value = re.sub(r"\([^)]*\)", "", value).replace("...", "").strip(" .+·")
        if value and value not in values and len(value) <= 8:
            values.append(value)
        if len(values) == 1:
            break
    return values or ["常用词"]


def choose_definition(entry: dict, row: dict) -> str:
    if entry["headword"] in PHRASE_DEFINITIONS:
        return PHRASE_DEFINITIONS[entry["headword"]]
    lines = [
        line.strip()
        for line in row.get("definition", "").replace("\\n", "\n").splitlines()
        if line.strip()
    ]
    example_words = set(re.findall(r"[a-z]+", " ".join(entry["officialExamples"]).lower()))
    scored = []
    for line in lines:
        clean = re.sub(r"^(?:n|v|a|s|r|adv|prep|conj|pron)\.?\s+", "", line, flags=re.I)
        overlap = len(example_words & set(re.findall(r"[a-z]+", clean.lower())))
        scored.append((overlap, -len(clean), clean))
    if example_words:
        value = max(scored, default=(0, 0, "used in everyday English"))[2]
    else:
        value = scored[0][2] if scored else "used in everyday English"
    value = re.split(r"[;:]|\b(?:who|which)\b", value, maxsplit=1, flags=re.I)[0]
    value = re.sub(r"\([^)]*\)", "", value).strip(" .")
    for hard, easy in SIMPLE_REPLACEMENTS.items():
        value = re.sub(rf"\b{re.escape(hard)}\b", easy, value, flags=re.I)
    words = value.split()
    if len(words) > 8:
        words = words[:8]
    value = " ".join(words).strip(" ,.-")
    if len(value.split()) < 3:
        pos = friendly_pos(entry["partOfSpeechOfficial"])
        if has_pos(pos, "noun"):
            value = "a person place or thing"
        elif has_pos(pos, "verb"):
            value = "to do this action"
        elif has_pos(pos, "adjective"):
            value = "used to describe something"
        else:
            value = "used in everyday English"
    return value[:1].lower() + value[1:]


def authored_example(entry: dict, definition: str) -> str:
    headword = entry["headword"]
    if headword in EXAMPLE_OVERRIDES:
        return EXAMPLE_OVERRIDES[headword]
    pos = friendly_pos(entry["partOfSpeechOfficial"])
    clean = re.sub(r"\([^)]*\)", "", headword).strip()
    if "/" in clean:
        clean = clean.split("/")[0].strip()
    if "phrasal verb" in pos or pos == "verb":
        if re.search(r"\b(?:it|them|someone|somebody|something|thing|person)\b", definition, re.I):
            return f"Please {clean} it now."
        return f"We can {clean} together."
    if "modal verb" in pos:
        return f"We {clean} go home now."
    if "adjective" in pos:
        lower = clean.lower()
        if lower in COLOUR_HEADWORDS:
            return f"The kite is {clean}."
        if lower in WEATHER_ADJECTIVES:
            return f"The sky looks {clean} today."
        if lower in FEELING_ADJECTIVES:
            return f"The child feels {clean} today."
        if lower in FOOD_ADJECTIVES:
            return f"The soup tastes {clean}."
        if lower in MATERIAL_HEADWORDS:
            return f"The cup is made of {clean}."
        if lower == "wooden":
            return "The table is wooden."
        return f"This looks {clean} to me."
    if "adverb" in pos:
        return f"We can meet {clean}."
    if "preposition" in pos:
        return f"The ball is {clean} the box."
    if "exclamation" in pos:
        return f"{headword} We did it together!"
    if has_pos(pos, "noun"):
        if clean.lower() in PERSON_HEADWORDS or re.match(r"^(?:a|an|the) (?:person|child|man|woman|boy|girl|worker|teacher|doctor|friend|family member)\b", definition, re.I):
            return f"The {clean} smiled at us."
        if re.search(r"\b(?:animal|bird|fish|insect)\b", definition, re.I):
            article = "an" if clean[:1].lower() in "aeiou" else "a"
            return f"I saw {article} {clean} outside."
        if re.match(r"^(?:a|an|the) (?:place|room|building|shop|station|school|park|centre|center)\b", definition, re.I) or re.search(r"\bplace (?:where|to|for)\b", definition, re.I):
            return f"We went to the {clean}."
        if clean.lower() in SPORTS_NO_ARTICLE:
            return f"We play {clean} after school."
        if clean.lower() in ACTIVITY_HEADWORDS:
            return f"We enjoy {clean} after school."
        if re.search(r"\bgame\b", definition, re.I):
            article = "an" if clean[:1].lower() in "aeiou" else "a"
            return f"We played {article} {clean} after school."
        if re.search(r"\b(?:trip|journey|idea|feeling|fact|reason|problem|choice|chance|event|change|success|life|future|past|work|job|information|talk)\b", definition, re.I):
            return f"We talked about the {clean}."
        if re.search(r"\b(?:information|advice|homework|music|water|food|money|weather|work|fun|help|news|rice|bread|cheese|coffee|tea|milk|air|snow|rain|sport|art|history|science|maths)\b", clean, re.I):
            return f"We talked about {clean}."
        if re.search(r"\b(?:food|drink|meal|fruit|vegetable|meat)\b", definition, re.I):
            return f"We had {clean} for lunch."
        if re.search(r"\b(?:day|week|month|year|time)\b", definition, re.I):
            return f"We talked about {clean} today."
        if "plural" in pos or clean.endswith("s") and not clean.endswith("ss"):
            return f"These {clean} are easy to see."
        article = "an" if clean[:1].lower() in "aeiou" else "a"
        return f"Here is {article} {clean}."
    return f"We use {clean} in class."


def image_alt(entry: dict, definition: str) -> str:
    pos = friendly_pos(entry["partOfSpeechOfficial"])
    headword = entry["headword"]
    if has_pos(pos, "noun"):
        return f"one clear {headword} in a quiet storybook scene"
    if has_pos(pos, "verb"):
        return f"one rounded child clearly acting out {headword}"
    if has_pos(pos, "adjective"):
        return f"one rounded character or object that looks {headword}"
    return f"one simple storybook scene showing {definition}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--official", type=Path, default=Path("src/data/ket-2025-official.json"))
    parser.add_argument("--approved-a", type=Path, default=Path("src/data/ket-a.json"))
    parser.add_argument("--reviewed-bz", type=Path, default=Path("src/data/ket-bz-reviewed.json"))
    parser.add_argument("--dictionary", type=Path, default=Path("tmp/ecdict.csv"))
    parser.add_argument("--simple-dictionary", type=Path, default=Path("tmp/simple-wiktionary.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("src/data/ket-course.json"))
    args = parser.parse_args()

    official = json.loads(args.official.read_text())
    approved_a = json.loads(args.approved_a.read_text())
    approved_by_headword = {entry["headword"]: entry for entry in approved_a["entries"]}
    reviewed_bz = json.loads(args.reviewed_bz.read_text())
    reviewed_by_id = {entry["id"]: entry for entry in reviewed_bz["cards"]}
    expected_bz_ids = {entry["id"] for entry in official["entries"] if entry["letter"] != "A"}
    reviewed_bz_ids = set(reviewed_by_id)
    if reviewed_bz_ids != expected_bz_ids:
        missing = sorted(expected_bz_ids - reviewed_bz_ids)
        extra = sorted(reviewed_bz_ids - expected_bz_ids)
        raise SystemExit(
            "B–Z editorial review is incomplete or out of range: "
            f"{len(missing)} missing, {len(extra)} unexpected"
        )
    dictionary = {}
    with args.dictionary.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            dictionary.setdefault(row["word"].lower(), row)
    simple_dictionary = load_simple_dictionary(args.simple_dictionary)

    entries = []
    for source in official["entries"]:
        if source["letter"] == "A" and source["headword"] in approved_by_headword:
            entry = dict(approved_by_headword[source["headword"]])
            entry.update(
                id=source["id"], letter="A", officialExamples=source["officialExamples"], sourcePage=source["sourcePage"]
            )
            entries.append(entry)
            continue
        row = dictionary_row(source, dictionary)
        simple_gloss, simple_examples = choose_simple_sense(source, simple_dictionary)
        reviewed = reviewed_by_id[source["id"]]
        definition = reviewed["definition"]
        cambridge_example = official_sentence(source["officialExamples"])
        child_example = reviewed["example"]
        entries.append(
            {
                "id": source["id"],
                "letter": source["letter"],
                "slug": source["slug"],
                "headword": source["headword"],
                "partOfSpeech": friendly_pos(source["partOfSpeechOfficial"]),
                "partOfSpeechOfficial": source["partOfSpeechOfficial"],
                "chineseGlosses": reviewed["chineseGlosses"],
                "definition": definition,
                "example": cambridge_example or child_example,
                "exampleSource": "cambridge" if cambridge_example else "authored",
                "officialExamples": source["officialExamples"],
                "imageAlt": image_alt(source, definition),
                "ukAudio": f"/audio/uk/{source['slug']}.mp3",
                "image": f"/images/{source['letter'].lower()}/{source['slug']}.webp",
                "sourcePage": source["sourcePage"],
            }
        )

    grouped = defaultdict(list)
    for entry in entries:
        grouped[entry["letter"]].append(entry)
    groups = [
        {
            "id": letter,
            "title": f"Group {letter}",
            "count": len(cards),
            "firstEntryId": cards[0]["id"],
            "lastEntryId": cards[-1]["id"],
        }
        for letter, cards in grouped.items()
    ]
    course = {
        "title": "Cambridge KET Flashcards",
        "edition": official["edition"],
        "sourceTitle": official["title"],
        "totalEntries": len(entries),
        "groups": groups,
        "entries": entries,
        "appendixes": {
            "wordSets": official["wordSets"],
            "topicLists": official["topicLists"],
            "topicAliases": TOPIC_TERM_ALIASES,
        },
    }
    args.output.write_text(json.dumps(course, ensure_ascii=False, indent=2) + "\n")
    print(f"Built {len(entries)} cards in {len(groups)} letter groups.")


if __name__ == "__main__":
    main()
