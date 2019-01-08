fetch('https://evilmartians.com/locations')
  .then(responce => responce.json())
  .then(console.log)
