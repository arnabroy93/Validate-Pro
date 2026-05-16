async function run() {
  const res = await fetch('https://api.dicebear.com/9.x/personas/schema.json');
  const schema = await res.json();
  console.log('skinColor schema: ', schema.properties.skinColor);
  console.log('hairColor schema: ', schema.properties.hairColor);
}

run();
