require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const app = express();

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const MEMBER_ROLE_ID = process.env.DISCORD_MEMBER_ROLE_ID;

// Prüfen, ob alle erforderlichen Umgebungsvariablen vorhanden sind
if (!BOT_TOKEN || !GUILD_ID || !MEMBER_ROLE_ID) {
  console.error(
    "Fehler: Bitte DISCORD_BOT_TOKEN, DISCORD_GUILD_ID und DISCORD_MEMBER_ROLE_ID konfigurieren."
  );
  process.exit(1);
}

// Discord-Bot initialisieren
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

app.disable("x-powered-by");

// Status-Endpunkt
app.get("/", (req, res) => {
  res.json({
    name: "CDB bäumlis Discord API",
    status: client.isReady() ? "online" : "starting",
    endpoints: ["/api/members"]
  });
});

// Discord-Mitglieder mit der Rolle "Mitglied" abrufen
app.get("/api/members", async (req, res) => {
  try {
    if (!client.isReady()) {
      return res.status(503).json({
        success: false,
        error: "Der Discord-Bot ist noch nicht bereit."
      });
    }

    const guild = await client.guilds.fetch(GUILD_ID);

    if (!guild) {
      return res.status(404).json({
        success: false,
        error: "Discord-Server nicht gefunden."
      });
    }

    // Mitglieder des Servers abrufen
    const members = await guild.members.fetch();

    // Ausschließlich Mitglieder mit der konfigurierten Rolle
    // und ohne Bot-Konten auswählen
    const filteredMembers = members
      .filter(member =>
        member.roles.cache.has(MEMBER_ROLE_ID) &&
        !member.user.bot
      )
      .map(member => ({
        id: member.user.id,
        username: member.user.username,
        nickname: member.nickname,
        avatar: member.user.displayAvatarURL({
          extension: "png",
          size: 128
        })
      }));

    // Nach Nickname oder Benutzername sortieren
    filteredMembers.sort((a, b) =>
      (a.nickname || a.username).localeCompare(
        b.nickname || b.username,
        "de"
      )
    );

    // Antwort nicht dauerhaft zwischenspeichern
    res.set("Cache-Control", "no-store");

    return res.json({
      success: true,
      count: filteredMembers.length,
      roleId: MEMBER_ROLE_ID,
      members: filteredMembers
    });
  } catch (error) {
    console.error(
      "Fehler beim Abrufen der Discord-Mitglieder:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Die Discord-Mitglieder konnten nicht geladen werden."
    });
  }
});

// Fehler für unbekannte Endpunkte
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "API-Endpunkt nicht gefunden."
  });
});

// Discord-Verbindung und Webserver starten
async function start() {
  try {
    await client.login(BOT_TOKEN);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`CDB Discord API läuft auf Port ${PORT}.`);
    });
  } catch (error) {
    console.error(
      "Der Discord-Bot konnte nicht gestartet werden:",
      error.message
    );

    process.exit(1);
  }
}

// Discord-Fehler protokollieren
client.on("error", error => {
  console.error("Discord-Client-Fehler:", error.message);
});

start();