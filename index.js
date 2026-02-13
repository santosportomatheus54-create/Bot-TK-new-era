const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

// Coloque seu token direto aqui:
const TOKEN = MTQ3MjAwMTE2ODY4NjE4NjYxOQ.GupDWG.xP8HreIq93RrqhdHrNcRlo8mipsH6Yo8wWnP9Q; // ⚠️ NÃO compartilhe este token

// Limite da subfila
const LIMITE_SUBFILA = 2;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// Delay utilitário
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Valores das filas
const VALORES = [100, 50, 20, 10, 5, 2, 1];

// Estrutura das filas
let filas = {};

// ================= EMBED =================
function criarEmbed(valor) {
  const fila = filas[valor];
  return new EmbedBuilder()
    .setTitle(`❄️ FILA R$ ${valor}`)
    .setDescription(
      `🧊 Gelo Infinito (${fila.infinito.length}/${LIMITE_SUBFILA})\n` +
      `❄️ Gelo Normal (${fila.normal.length}/${LIMITE_SUBFILA})`
    )
    .setColor("#0d1b2a")
    .setFooter({ text: "Sistema Profissional • Azul & Preto" })
    .setTimestamp();
}

// ================= BOTÕES =================
function criarBotoes(valor) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`infinito_${valor}`)
      .setLabel("🧊 Gelo Infinito")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`normal_${valor}`)
      .setLabel("❄️ Gelo Normal")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`sair_${valor}`)
      .setLabel("🚪 Sair")
      .setStyle(ButtonStyle.Danger)
  );
}

// ================= READY =================
client.once("ready", async () => {
  console.log(`✅ Online como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("painel")
      .setDescription("Abrir painel de filas com escolha de modo")
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    // Opcional: colocar o GUILD_ID direto aqui se quiser registro rápido
    const GUILD_ID = 1470171831292919982; // ou deixe vazio para global
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, GUILD_ID),
        { body: commands }
      );
      console.log("✅ Comandos registrados no servidor");
    } else {
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      console.log("✅ Comandos registrados globalmente");
    }
  } catch (err) {
    console.error("Erro ao registrar comandos:", err);
  }
});

// ================= FUNÇÃO CRIAR CANAL =================
async function criarCanalPartida(guild, valor, tipo, jogadores) {
  const nomeCanal = `🎮 ${tipo.toUpperCase()} R$${valor}`;

  const canal = await guild.channels.create({
    name: nomeCanal,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      ...jogadores.map(id => ({
        id,
        allow: [PermissionsBitField.Flags.ViewChannel]
      }))
    ]
  });

  await canal.send(
    `🔹 Partida criada!\n` +
    `Fila: R$${valor} • Tipo: ${tipo}\n` +
    `Jogadores: ${jogadores.map(id => `<@${id}>`).join(", ")}`
  );

  // Remove jogadores da subfila
  filas[valor][tipo] = filas[valor][tipo].filter(id => !jogadores.includes(id));
}

// ================= INTERAÇÕES =================
client.on("interactionCreate", async interaction => {

  // ===== SLASH COMMAND =====
  if (interaction.isChatInputCommand() && interaction.commandName === "painel") {
    const select = new StringSelectMenuBuilder()
      .setCustomId("selecionar_modo")
      .setPlaceholder("Escolha o modo")
      .addOptions([
        { label: "1v1", value: "1v1" },
        { label: "2v2", value: "2v2" },
        { label: "3v3", value: "3v3" },
        { label: "4v4", value: "4v4" }
      ]);

    await interaction.reply({
      content: "🔹 Escolha o modo da partida:",
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
  }

  // ===== MENU SELEÇÃO DE MODO =====
  if (interaction.isStringSelectMenu() && interaction.customId === "selecionar_modo") {
    const modo = interaction.values[0];
    await interaction.update({ content: `✅ Modo selecionado: ${modo}\nCriando filas...`, components: [] });

    for (let valor of VALORES) {
      filas[valor] = { infinito: [], normal: [] };

      await interaction.channel.send({
        embeds: [criarEmbed(valor)],
        components: [criarBotoes(valor)]
      });

      await delay(2000);
    }

    await interaction.followUp({ content: "✅ Todas as 7 filas criadas!", ephemeral: true });
  }

  // ===== BOTÕES =====
  if (interaction.isButton()) {
    const [tipo, valor] = interaction.customId.split("_");
    const userId = interaction.user.id;

    if (!filas[valor]) return;

    // Remove usuário de ambas subfilas
    filas[valor].infinito = filas[valor].infinito.filter(id => id !== userId);
    filas[valor].normal = filas[valor].normal.filter(id => id !== userId);

    if (tipo === "infinito") filas[valor].infinito.push(userId);
    if (tipo === "normal") filas[valor].normal.push(userId);

    // Se a subfila atingir 2 jogadores, cria canal
    const subfila = filas[valor][tipo];
    if (subfila.length >= LIMITE_SUBFILA) {
      await criarCanalPartida(interaction.guild, valor, tipo, [...subfila]);
    }

    await interaction.update({
      embeds: [criarEmbed(valor)],
      components: [criarBotoes(valor)]
    });
  }
});

client.login(TOKEN);
