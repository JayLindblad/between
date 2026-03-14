-- Between Readers — Seed Data
-- Paste into the Supabase SQL Editor and run.
-- 20 books + 3–6 entries each (~90 entries total).

-- ── Books ─────────────────────────────────────────────────────────────────────

insert into books (isbn, title, author, cover_url, release_note, released_by, passcode) values
  ('9780743273565', 'The Great Gatsby',                  'F. Scott Fitzgerald',  'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg', 'Left on a bench in Millennium Park. Find it, read it, pass it on.', 'Maya R.',    '482031'),
  ('9780061120084', 'To Kill a Mockingbird',             'Harper Lee',           'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg', 'Slipped inside the magazine rack at a coffee shop. Enjoy.', 'Daniel K.',  '719405'),
  ('9780141187761', 'Nineteen Eighty-Four',              'George Orwell',        'https://covers.openlibrary.org/b/isbn/9780141187761-L.jpg', 'Released from a hostel common room bookshelf. May it find you well.', 'Priya S.',   '336812'),
  ('9780062315007', 'The Alchemist',                     'Paulo Coelho',         'https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg', 'Left at a train station. Your personal legend awaits.', 'Tomás V.',   '904157'),
  ('9780374528379', 'Waiting for Godot',                 'Samuel Beckett',       'https://covers.openlibrary.org/b/isbn/9780374528379-L.jpg', 'Found this in a secondhand shop and set it free again.', 'Isla M.',    '261748'),
  ('9780525559474', 'The Midnight Library',              'Matt Haig',            'https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg', 'Left on a park bench. Life is full of infinite possibilities.', 'Cleo F.',    '573290'),
  ('9781501156700', 'The Kite Runner',                   'Khaled Hosseini',      'https://covers.openlibrary.org/b/isbn/9781501156700-L.jpg', 'Released near the harbour. For you, a thousand times over.', 'James T.',   '847623'),
  ('9780385490818', 'The Handmaid''s Tale',              'Margaret Atwood',      'https://covers.openlibrary.org/b/isbn/9780385490818-L.jpg', 'Left in the women''s section of the library free shelf.', 'Nora W.',    '192847'),
  ('9780316769174', 'The Catcher in the Rye',            'J.D. Salinger',        'https://covers.openlibrary.org/b/isbn/9780316769174-L.jpg', 'Dropped off at a diner counter. Don''t be a phony.', 'Eli B.',     '658304'),
  ('9781594634024', 'A Long Way Gone',                   'Ishmael Beah',         'https://covers.openlibrary.org/b/isbn/9781594634024-L.jpg', 'Left at a community centre. A story that must keep moving.', 'Amara D.',   '431076'),
  ('9780307454546', '2666',                              'Roberto Bolaño',       'https://covers.openlibrary.org/b/isbn/9780307454546-L.jpg', 'Released from an airport departure lounge. Long journey ahead.', 'Sofia L.',   '759132'),
  ('9780143127741', 'Norwegian Wood',                    'Haruki Murakami',      'https://covers.openlibrary.org/b/isbn/9780143127741-L.jpg', 'Left in a record shop. Put on some Beatles and read.', 'Ren O.',     '284615'),
  ('9780679720201', 'Invisible Man',                     'Ralph Ellison',        'https://covers.openlibrary.org/b/isbn/9780679720201-L.jpg', 'Released from a university campus bench.', 'Marcus H.',  '913047'),
  ('9780374104047', 'Things Fall Apart',                 'Chinua Achebe',        'https://covers.openlibrary.org/b/isbn/9780374104047-L.jpg', 'Left at a hotel lobby. Okonkwo''s story belongs to the world.', 'Adaeze N.',  '506829'),
  ('9781250301697', 'Normal People',                     'Sally Rooney',         'https://covers.openlibrary.org/b/isbn/9781250301697-L.jpg', 'Left at a café in the arts district. Pass it along when you''re done.', 'Fiona C.',   '378154'),
  ('9780385333481', 'A Hundred Years of Solitude',       'Gabriel García Márquez','https://covers.openlibrary.org/b/isbn/9780060883287-L.jpg', 'Dropped off at the botanical garden entrance. Many Buendías to meet.', 'Lucia P.',   '642918'),
  ('9780679745587', 'Beloved',                           'Toni Morrison',        'https://covers.openlibrary.org/b/isbn/9780679745587-L.jpg', 'Left at a library free shelf. This one is not to be forgotten.', 'Kezia A.',   '817350'),
  ('9780140283297', 'Crime and Punishment',              'Fyodor Dostoevsky',    'https://covers.openlibrary.org/b/isbn/9780140283297-L.jpg', 'Released from a bookshop steps. Heavy book, heavy thoughts.', 'Ivan R.',    '094726'),
  ('9781501173219', 'Where the Crawdads Sing',           'Delia Owens',          'https://covers.openlibrary.org/b/isbn/9781501173219-L.jpg', 'Left by a nature trail entrance. The marsh knows all secrets.', 'Hannah J.',  '361584'),
  ('9780525478812', 'The Fault in Our Stars',            'John Green',           'https://covers.openlibrary.org/b/isbn/9780525478812-L.jpg', 'Left at a hospital waiting room. Read it. Cry. Pass it on.', 'Oliver G.',  '729406')
on conflict (isbn) do nothing;


-- ── Entries ───────────────────────────────────────────────────────────────────

insert into entries (isbn, found_location, location_description, message, found_date, lat, lng, created_at) values

-- The Great Gatsby
('9780743273565', 'Chicago, Illinois',          'On a green bench near the Crown Fountain',          'Found it on my lunch break. Gatsby''s longing felt very real in this city. Leaving it in Portland next week.',     '2025-03-12', 41.8827,  -87.6233, '2025-03-12 14:22:00+00'),
('9780743273565', 'Portland, Oregon',           'Inside Powell''s Books, on the free shelf by the door','What a surprise to find this here! Read it in two evenings. Passing it to a friend in Edinburgh.',               '2025-04-01', 45.5231,  -122.6816,'2025-04-01 10:05:00+00'),
('9780743273565', 'Edinburgh, Scotland',        'Left on a bench on the Royal Mile',                 'My second time reading this. The green light hits different every time. Setting it free again.',                   '2025-05-14', 55.9500,  -3.1883,  '2025-05-14 16:44:00+00'),
('9780743273565', 'Amsterdam, Netherlands',     'In a café near Vondelpark',                         'A Dutch friend translated passages for me. Left it for the next reader at the hostel I''m staying in.',           '2025-07-03', 52.3576,  4.8686,   '2025-07-03 09:30:00+00'),

-- To Kill a Mockingbird
('9780061120084', 'Nashville, Tennessee',       'On the counter of a diner on Broadway',             'Justice, empathy, courage. Still one of the most important American novels. Leaving it in New Orleans.',           '2025-02-20', 36.1612,  -86.7775, '2025-02-20 08:15:00+00'),
('9780061120084', 'New Orleans, Louisiana',     'On a bench in Jackson Square',                      'Read it in the French Quarter. Atticus feels like a ghost here. Passing it north.',                               '2025-03-08', 29.9584,  -90.0644, '2025-03-08 17:30:00+00'),
('9780061120084', 'Memphis, Tennessee',         'Left at a laundromat on Union Avenue',              'Someone was reading over my shoulder by the dryers. Gave it to them directly.',                                   '2025-03-22', 35.1495,  -90.0490, '2025-03-22 11:20:00+00'),
('9780061120084', 'St. Louis, Missouri',        'Coffee shop near Washington University',            'A law student at the next table asked about the cover. We talked for an hour. Leaving it for them.',             '2025-04-10', 38.6488,  -90.3108, '2025-04-10 13:45:00+00'),
('9780061120084', 'Kansas City, Missouri',      'Free shelf at the public library branch on Oak St', 'Full circle — back in a library where it belongs, at least for a moment.',                                        '2025-05-02', 39.0997,  -94.5786, '2025-05-02 15:00:00+00'),

-- Nineteen Eighty-Four
('9780141187761', 'London, England',            'Left on the Tube (Central line, seat pocket)',      'Read it on the commute. The telescreens feel less fictional every year. Sending it to Berlin.',                   '2025-01-15', 51.5074,  -0.1278,  '2025-01-15 08:42:00+00'),
('9780141187761', 'Berlin, Germany',            'Café near Checkpoint Charlie',                      'Read it in the shadow of history. Left it on the table when I paid the bill.',                                   '2025-02-03', 52.5252,  13.3904,  '2025-02-03 12:10:00+00'),
('9780141187761', 'Warsaw, Poland',             'On a park bench in Łazienki Park',                  'My grandmother remembered 1984. Reading this felt like hearing her again. Leaving it here.',                      '2025-03-17', 52.2103,  21.0354,  '2025-03-17 14:55:00+00'),
('9780141187761', 'Prague, Czech Republic',     'Inside a secondhand bookshop on Náměstí Míru',     'The bookseller stamped the inside cover with a tiny fist. Not sure what it means but I love it.',                '2025-04-28', 50.0755,  14.4378,  '2025-04-28 10:30:00+00'),

-- The Alchemist
('9780062315007', 'Lisbon, Portugal',           'On the steps of Alfama overlooking the river',     'Started it at sunrise. Finished it by noon. Released it where I read the last page.',                             '2025-03-05', 38.7169,  -9.1399,  '2025-03-05 12:05:00+00'),
('9780062315007', 'Seville, Spain',             'Left at a tapas bar near Plaza de España',         'The desert scenes make more sense after walking around here all day. Passing it south.',                          '2025-03-20', 37.3886,  -5.9823,  '2025-03-20 19:20:00+00'),
('9780062315007', 'Marrakech, Morocco',         'In the lobby of a riad in the medina',             'The world conspired for me to read this in Morocco. I am not surprised.',                                         '2025-04-11', 31.6295,  -7.9811,  '2025-04-11 08:00:00+00'),
('9780062315007', 'Casablanca, Morocco',        'Left at the Hassan II Mosque entrance plaza',      'A tour guide asked me what I was reading. We talked about maktub. He kept the book.',                            '2025-04-22', 33.6086,  -7.6327,  '2025-04-22 11:40:00+00'),

-- The Midnight Library
('9780525559474', 'Bristol, England',           'On a bench in Brandon Hill park',                  'Read this during a really low week. It helped. Leaving it where someone else might need it.',                     '2025-01-28', 51.4545,  -2.5879,  '2025-01-28 15:00:00+00'),
('9780525559474', 'Bath, England',              'Left at a café table near the Roman Baths',        'Someone had underlined "It is possible to both live and to be afraid" in pencil. Left it.',                       '2025-02-14', 51.3811,  -2.3590,  '2025-02-14 11:30:00+00'),
('9780525559474', 'Cardiff, Wales',             'Free shelf at Cardiff Central Library',            'Added a small note inside: "You are enough." Hope whoever reads next needed it.',                                 '2025-03-01', 51.4837,  -3.1681,  '2025-03-01 09:50:00+00'),
('9780525559474', 'Dublin, Ireland',            'Left at the counter of a pub in Temple Bar',       'Told the barman to give it to whoever looked like they needed a good book. He nodded knowingly.',                '2025-03-30', 53.3454,  -6.2648,  '2025-03-30 20:15:00+00'),
('9780525559474', 'Galway, Ireland',            'On the windowsill of a B&B common room',           'Read it in one sitting, wrapped in a blanket with rain on the glass. Perfect conditions.',                        '2025-04-18', 53.2707,  -9.0568,  '2025-04-18 22:00:00+00'),

-- The Kite Runner
('9781501156700', 'Vancouver, British Columbia','Bench near the seawall in Stanley Park',           'Read it here on a grey afternoon. Cried three times. For you, a thousand times over.',                            '2025-02-07', 49.3043,  -123.1443,'2025-02-07 14:00:00+00'),
('9781501156700', 'Seattle, Washington',        'Left at the Fremont public library branch',        'A librarian saw me return it to the shelf and stamped it anyway. I love this city.',                              '2025-02-24', 47.6512,  -122.3476,'2025-02-24 10:30:00+00'),
('9781501156700', 'San Francisco, California',  'Dolores Park, near the top of the hill',           'Read the last chapter watching the fog roll in. Left it under the bench in a ziplock bag.',                      '2025-03-15', 37.7596,  -122.4269,'2025-03-15 17:45:00+00'),
('9781501156700', 'Los Angeles, California',    'Left at a Persian restaurant in Westwood',         'The owner recognised the cover and told me about his own journey here. He asked to keep it.',                    '2025-04-05', 34.0583,  -118.4427,'2025-04-05 12:00:00+00'),

-- The Handmaid's Tale
('9780385490818', 'Toronto, Ontario',           'On a bench outside the Ontario Legislature',       'An appropriate place for this one. Left it with a note: "Read. Remember. Resist."',                              '2025-02-11', 43.6629,  -79.3957, '2025-02-11 13:30:00+00'),
('9780385490818', 'Ottawa, Ontario',            'Coffee shop near Parliament Hill',                 'A group of students argued about it at the next table. I left it on their table when I went.',                  '2025-03-03', 45.4215,  -75.6919, '2025-03-03 16:00:00+00'),
('9780385490818', 'Montreal, Quebec',           'Left at a feminist bookshop on St-Denis',          'Brought it full circle — back to a bookshop, at least for now.',                                                  '2025-03-25', 45.5231,  -73.5817, '2025-03-25 11:15:00+00'),
('9780385490818', 'Quebec City, Quebec',        'In the waiting room of a community clinic',        'Felt right to leave it somewhere people have time to think and nowhere to go.',                                  '2025-04-14', 46.8139,  -71.2080, '2025-04-14 09:00:00+00'),

-- The Catcher in the Rye
('9780316769174', 'New York City, New York',    'Left on a bench in Central Park near the pond',   'It felt wrong to let this leave New York. But Holden would have wanted it to.',                                  '2025-01-20', 40.7736,  -73.9712, '2025-01-20 11:00:00+00'),
('9780316769174', 'Boston, Massachusetts',      'Tucked into a booth at a diner in Cambridge',      'A Harvard freshman found it. We talked for 20 minutes. She seemed less phony than most.',                        '2025-02-08', 42.3736,  -71.1097, '2025-02-08 08:30:00+00'),
('9780316769174', 'Providence, Rhode Island',   'On the steps of the RISD museum',                 'Art students kept walking past. One stopped, read the back, and sat down. Left it.',                            '2025-02-28', 41.8268,  -71.4028, '2025-02-28 14:20:00+00'),

-- Norwegian Wood
('9780143127741', 'Tokyo, Japan',               'Record shop in Shimokitazawa',                    'Found a copy of "Norwegian Wood" by the Beatles playing. Too perfect. Left the book.',                           '2025-02-16', 35.6619,  139.6683, '2025-02-16 15:30:00+00'),
('9780143127741', 'Kyoto, Japan',               'On a stone bench in the bamboo grove, Arashiyama', 'The quiet here matched the book''s mood. Left it in the hollow of a bamboo stalk holder.',                     '2025-03-04', 35.0094,  135.6727, '2025-03-04 09:15:00+00'),
('9780143127741', 'Osaka, Japan',               'Coffee shop in Shinsaibashi',                     'Read it in three days and felt sad in the most beautiful way. A stranger asked about it.',                       '2025-03-18', 34.6722,  135.5005, '2025-03-18 14:00:00+00'),
('9780143127741', 'Hiroshima, Japan',           'Near the Peace Memorial Museum entrance',          'This city makes every story feel more fragile. Left it on the stone ledge.',                                    '2025-04-02', 34.3955,  132.4531, '2025-04-02 10:45:00+00'),

-- Invisible Man
('9780679720201', 'Harlem, New York',           'On a bench outside the Schomburg Center',         'Found in a perfect spot. Read the prologue twice. The invisibility is a kind of freedom.',                       '2025-03-10', 40.8145,  -73.9416, '2025-03-10 13:00:00+00'),
('9780679720201', 'Philadelphia, Pennsylvania', 'Left at a café near the Barnes Foundation',       'A professor saw the cover and asked if I''d taken his course. I hadn''t. We talked about the Brotherhood.',     '2025-03-28', 39.9621,  -75.1733, '2025-03-28 11:30:00+00'),
('9780679720201', 'Washington D.C.',            'On a bench on the National Mall',                 'Left it facing the Lincoln Memorial. I think Ellison would approve.',                                            '2025-04-17', 38.8895,  -77.0353, '2025-04-17 15:45:00+00'),

-- Things Fall Apart
('9780374104047', 'Lagos, Nigeria',             'Left at a bookshop on Awolowo Road',               'Coming home. Achebe''s work deserves to live in Lagos as much as anywhere.',                                    '2025-01-30', 6.4281,   3.4219,   '2025-01-30 10:00:00+00'),
('9780374104047', 'Accra, Ghana',               'On a bench in Labadi Beach park',                  'A fisherman asked me to read him a passage. I did. He nodded slowly. Left it with him.',                       '2025-02-18', 5.5600,   -0.1969,  '2025-02-18 16:00:00+00'),
('9780374104047', 'Nairobi, Kenya',             'Nairobi National Museum café',                     'Felt like a pilgrimage to read this here. Left it in the English-language shelf.',                             '2025-03-12', -1.2921,  36.8219,  '2025-03-12 14:30:00+00'),
('9780374104047', 'Cape Town, South Africa',    'On a bench at the V&A Waterfront',                 'The view of Table Mountain made everything feel ancient and new at once. Left it here.',                        '2025-04-08', -33.9006, 18.4200,  '2025-04-08 11:00:00+00'),
('9780374104047', 'Johannesburg, South Africa', 'Free shelf at a community library in Soweto',     'Brought it to the community where Achebe''s themes live loudest.',                                              '2025-05-01', -26.2485, 27.8546,  '2025-05-01 09:30:00+00'),

-- Normal People
('9781250301697', 'Dublin, Ireland',            'Left at Whelans pub on Wexford St',                'Marianne and Connell feel so Irish it hurts. Left it where the music plays.',                                   '2025-02-22', 53.3324,  -6.2677,  '2025-02-22 21:30:00+00'),
('9781250301697', 'Cork, Ireland',              'Bench near the English Market',                    'Read it on the train from Dublin. Finished just as we pulled in. Cried in public.',                            '2025-03-09', 51.8985,  -8.4756,  '2025-03-09 18:00:00+00'),
('9781250301697', 'London, England',            'Left at a café in Hackney',                        'You can spot the Sally Rooney readers from how they hold their coffee. Left it for one of them.',              '2025-03-30', 51.5450,  -0.0554,  '2025-03-30 09:45:00+00'),
('9781250301697', 'Edinburgh, Scotland',        'On a bench outside the Scottish National Gallery', 'A stranger spotted the cover and said "oh that one." We understood each other immediately.',                    '2025-04-20', 55.9500,  -3.1950,  '2025-04-20 14:00:00+00'),

-- A Hundred Years of Solitude
('9780385333481', 'Bogotá, Colombia',           'In the magical realism section of Librería Lerner','Returning García Márquez to his homeland felt right. Even if Macondo is everywhere.',                           '2025-01-25', 4.7110,   -74.0721, '2025-01-25 11:00:00+00'),
('9780385333481', 'Cartagena, Colombia',        'On a bench in the old walled city',               'The heat and the colour of this city IS the novel. Left it on a stone bench near the clock tower.',             '2025-02-10', 10.4236,  -75.5350, '2025-02-10 15:30:00+00'),
('9780385333481', 'Mexico City, Mexico',        'Café near Coyoacán market',                        'Frida Kahlo''s neighbourhood felt like the right latitude for this book.',                                     '2025-03-01', 19.3468,  -99.1614, '2025-03-01 13:00:00+00'),
('9780385333481', 'Buenos Aires, Argentina',    'Left at a secondhand bookshop in San Telmo',       'The bookseller gasped when she saw it had a sticker. I explained the whole project.',                          '2025-04-06', -34.6215, -58.3731, '2025-04-06 10:30:00+00'),
('9780385333481', 'Lima, Peru',                 'National Museum of Peru gift shop area',           'One hundred years later and the Buendía family still haven''t learned. Neither have I.',                      '2025-05-05', -12.0431, -77.0282, '2025-05-05 12:00:00+00'),

-- Beloved
('9780679745587', 'Cincinnati, Ohio',           'On a bench at Eden Park overlook',                'This is where the story was born. Reading it here felt like a responsibility.',                                  '2025-02-05', 39.1175,  -84.4968, '2025-02-05 14:00:00+00'),
('9780679745587', 'Louisville, Kentucky',       'Left at a café near the Muhammad Ali Center',      'Two great American stories in one block. Left Beloved at the door of the café.',                               '2025-02-25', 38.2527,  -85.7585, '2025-02-25 11:00:00+00'),
('9780679745587', 'Atlanta, Georgia',           'Free shelf at the Auburn Avenue library branch',   'This book belongs in this city. In every city. But especially this one.',                                      '2025-03-18', 33.7545,  -84.3762, '2025-03-18 10:15:00+00'),
('9780679745587', 'New Orleans, Louisiana',     'Left at a bench in Congo Square, Louis Armstrong Park', 'The history of this place and this book are the same history. Left it here with intention.',             '2025-04-09', 29.9612,  -90.0671, '2025-04-09 16:00:00+00'),

-- Crime and Punishment
('9780140283297', 'St. Petersburg, Russia',     'In the lobby of a hotel near Nevsky Prospekt',    'Reading Raskolnikov in his own city. The guilt felt geographic.',                                              '2025-01-10', 59.9343,  30.3351,  '2025-01-10 13:00:00+00'),
('9780140283297', 'Helsinki, Finland',          'Left at a café near Senate Square',               'Crossed the Baltic. The cold follows the book.',                                                               '2025-01-28', 60.1699,  24.9384,  '2025-01-28 10:00:00+00'),
('9780140283297', 'Tallinn, Estonia',           'On a bench in the Old Town',                      'The medieval streets suited Dostoevsky''s psychology. Left it at a hostel bookshelf.',                        '2025-02-14', 59.4370,  24.7536,  '2025-02-14 15:30:00+00'),
('9780140283297', 'Riga, Latvia',               'Coffee shop near the central market',             'A philosophy student recognised it and sat down uninvited. We argued about Raskolnikov for two hours.',        '2025-03-05', 56.9496,  24.1052,  '2025-03-05 12:00:00+00'),
('9780140283297', 'Vilnius, Lithuania',         'Free shelf at the Vaga bookshop',                 'Left it in good company — surrounded by Lithuanian literature it had probably never met before.',              '2025-03-20', 54.6872,  25.2797,  '2025-03-20 14:00:00+00'),

-- Where the Crawdads Sing
('9781501173219', 'Outer Banks, North Carolina','On a bench at the Cape Hatteras Lighthouse',      'The marsh is real. Kya is everywhere here. Left it for someone who needs the quiet.',                          '2025-03-06', 35.2510,  -75.5310, '2025-03-06 10:00:00+00'),
('9781501173219', 'Savannah, Georgia',          'Left on a bench in Forsyth Park',                 'Spanish moss and secrets. This book fits Savannah like a skin.',                                               '2025-03-22', 32.0729,  -81.0948, '2025-03-22 14:00:00+00'),
('9781501173219', 'Charleston, South Carolina', 'On the steps of the old market',                  'A group of birders saw the cover and nodded approvingly. Left it on the steps.',                              '2025-04-10', 32.7765,  -79.9311, '2025-04-10 11:30:00+00'),
('9781501173219', 'Wilmington, North Carolina', 'Left at a dockside café near the waterfront',     'Read the last fifty pages watching pelicans. Wept appropriately. Passed it on.',                              '2025-05-03', 34.2257,  -77.9447, '2025-05-03 16:00:00+00'),

-- The Fault in Our Stars
('9780525478812', 'Indianapolis, Indiana',      'Left at the Kurt Vonnegut Museum and Library',    'John Green''s city. Left it somewhere he''d appreciate.',                                                      '2025-02-12', 39.7684,  -86.1581, '2025-02-12 11:00:00+00'),
('9780525478812', 'Pittsburgh, Pennsylvania',   'On a bench near the Carnegie Museum of Art',      'Hazel and Augustus feel like they belong in a city with good bones and sad winters.',                          '2025-03-01', 40.4440,  -79.9490, '2025-03-01 15:00:00+00'),
('9780525478812', 'Amsterdam, Netherlands',     'Near the Anne Frank House entrance',              'The Amsterdam chapters brought me here. Left it two blocks from where Hazel and Gus walked.',                  '2025-04-15', 52.3752,  4.8840,   '2025-04-15 13:00:00+00'),
('9780525478812', 'Utrecht, Netherlands',       'Left at a café near the university',              'A medical student at the next table looked sad. I left it on her table when she went to the counter.',        '2025-05-01', 52.0907,  5.1214,   '2025-05-01 10:30:00+00'),

-- A Long Way Gone
('9781594634024', 'Freetown, Sierra Leone',     'At the British Council reading room',             'Beah''s story begins not far from here. Left it where others might find it.',                                  '2025-01-22', 8.4657,   -13.2317, '2025-01-22 10:00:00+00'),
('9781594634024', 'Dakar, Senegal',             'Left at the Institut Français library shelf',     'A student asked if the story was true. I said yes. She sat down and started reading.',                        '2025-02-15', 14.7167,  -17.4677, '2025-02-15 14:00:00+00'),
('9781594634024', 'Geneva, Switzerland',        'Near the UN Palais des Nations gardens',          'This book belongs near rooms where people argue about peace. Left it at the entrance.',                        '2025-03-10', 46.2273,  6.1407,   '2025-03-10 12:00:00+00'),

-- 2666
('9780307454546', 'Barcelona, Spain',           'Left at the Boqueria market café',                'Started it six months ago. Finished it here. Left it at the table where I read the last page.',              '2025-02-28', 41.3818,  2.1734,   '2025-02-28 16:00:00+00'),
('9780307454546', 'Ciudad Juárez, Mexico',      'Left at a bookshop near the university',          'The geography of this book is real. Being here while reading Part IV was something I will not forget.',       '2025-04-01', 31.7300,  -106.4500,'2025-04-01 11:00:00+00'),
('9780307454546', 'Santiago, Chile',            'Bookshop in Barrio Lastarria',                    'A Bolaño novel in his home country. Left it where the literary people gather.',                               '2025-05-12', -33.4489, -70.6693, '2025-05-12 14:30:00+00'),
('9780307454546', 'Mexico City, Mexico',        'Left at the Fondo de Cultura Económica bookshop', 'Someone had written "read this before you die" on a Post-it inside the cover. Kept the note.',               '2025-06-03', 19.4326,  -99.1332, '2025-06-03 10:00:00+00');
