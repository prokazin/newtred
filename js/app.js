const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe.user;
const userId = user ? user.id : null;
const userName = user ? user.first_name : "Игрок";

let balance = 2000;

document.getElementById("balance").innerText = balance;

// Переключение вкладок
document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const tab = btn.dataset.tab;

        document.querySelectorAll(".tab-content").forEach(content => {
            content.classList.remove("active");
        });

        document.getElementById(tab).classList.add("active");
    });
});

// Торговля
function trade(coin) {
    const change = Math.round((Math.random() * 300 - 150));

    balance += change;
    if (balance < 0) balance = 0;

    document.getElementById("balance").innerText = balance;

    // Отправить результат боту
    fetch("/update_score", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            user_id: userId,
            name: userName,
            score: balance
        })
    });
}

// Загрузка рейтинга
async function loadRating() {
    const res = await fetch("/rating");
    const data = await res.json();

    const list = document.getElementById("rating-list");
    list.innerHTML = "";

    data.forEach(player => {
        const li = document.createElement("li");
        li.textContent = `${player.name}: ${player.score}$`;
        list.appendChild(li);
    });
}

loadRating();
setInterval(loadRating, 3000);
