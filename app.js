async function loadGames() {
  const res = await fetch('/data/games.json');
  const games = await res.json();

  const grid = document.getElementById('game-grid');
  const searchInput = document.getElementById('search');

  function render(list) {
    grid.innerHTML = '';
    list.forEach(g => {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.innerHTML = `
        <img src="${g.thumb}" alt="${g.name}">
        <h2>${g.name}</h2>
      `;
      card.onclick = () => {
        window.location.href = `/play.html?id=${encodeURIComponent(g.id)}`;
      };
      grid.appendChild(card);
    });
  }

  render(games);

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    render(
      games.filter(g =>
        g.name.toLowerCase().includes(q) ||
        g.tags.some(t => t.toLowerCase().includes(q))
      )
    );
  });
}

loadGames();
