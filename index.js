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

const TOKEN = "SEU_TOKEN_AQUI";
const LIMITE_SUBFILA = 2; // Cada subfila enche com 2 pessoas
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// Delay utilitário
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Valores fixos das filas
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

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );
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

  // Remove os jogadores da subfila
  filas[valor][tipo] = filas[valor][tipo].filter(id => !jogadores.includes(id));
}

// ================= INTERAÇÕES =================
client.on("interactionCreate", async interaction => {

  // ===== SLASH COMMAND =====
  if (interaction.isChatInputCommand() && interaction.commandName === "painel") {

    // Menu de seleção de modo
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

    // Cria todas as filas com delay
    for (let valor of VALORES) {
      filas[valor] = { infinito: [], normal: [] }; // Inicializa subfilas

      await interaction.channel.send({
        embeds: [criarEmbed(valor)],
        components: [criarBotoes(valor)]
      });

      await delay(2000); // Espera 2 segundos
    }

    await interaction.followUp({ content: "✅ Todas as 7 filas criadas!", ephemeral: true });
  }

  // ===== BOTÕES =====
  if (interaction.isButton()) {

    const [tipo, valor] = interaction.customId.split("_");
    const userId = interaction.user.id;

    if (!filas[valor]) return;

    // Remove usuário das duas subfilas
    filas[valor].infinito = filas[valor].infinito.filter(id => id !== userId);
    filas[valor].normal = filas[valor].normal.filter(id => id !== userId);

    // Adiciona à subfila escolhida
    if (tipo === "infinito") filas[valor].infinito.push(userId);
    if (tipo === "normal") filas[valor].normal.push(userId);

    // Checar se subfila atingiu o limite
    const subfila = filas[valor][tipo];
    if (subfila.length >= LIMITE_SUBFILA) {
      await criarCanalPartida(interaction.guild, valor, tipo, [...subfila]);
    }

    // Atualiza embed no canal
    await interaction.update({
      embeds: [criarEmbed(valor)],
      components: [criarBotoes(valor)]
    });
  }
});

client.login(TOKEN);
