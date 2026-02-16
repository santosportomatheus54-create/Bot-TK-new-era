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

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID; // opcional

const LIMITE_SUBFILA = 2;
const VALORES = [100, 50, 20, 10, 5, 2, 1];
const TEMPO_PARTIDA = 10 * 60 * 1000; // 10 minutos de partida

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// Delay utilitário
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ===== FILAS E STATUS =====
let filas = {};
const userStatus = new Map(); // userId => "fila" | "partida" | null
const queueTimers = new Map(); // userId => setTimeout

// ================= EMBED =================
function criarEmbed(valor, client) {
  const fila = filas[valor];

  const usuariosInfinito = fila.infinito.map(id => {
    const user = client.users.cache.get(id);
    return user ? user.username : "Desconhecido";
  });
  const usuariosNormal = fila.normal.map(id => {
    const user = client.users.cache.get(id);
    return user ? user.username : "Desconhecido";
  });

  return new EmbedBuilder()
    .setTitle(`ORG TK 💰 - Fila R$ ${valor}`)
    .setDescription(
      "🌟 Bem-vindo ao bot de filas da TK! 🌟\n" +
      "Organize partidas, eventos e filas de forma rápida e divertida! Com nosso sistema inteligente, você consegue:\n" +
      "🎮 Criar filas automáticas para jogos ou atividades\n" +
      "⚡ Gerenciar participantes com comandos simples\n" +
      "🏆 Iniciar partidas assim que o número ideal de pessoas for atingido\n" +
      "📝 Receber notificações e logs automáticos\n" +
      "💬 Interagir com botões intuitivos direto no Discord\n\n" +
      `💸 Gelo Infinito (${fila.infinito.length}/${LIMITE_SUBFILA}):\n` +
      (usuariosInfinito.length ? usuariosInfinito.join("\n") : "Nenhum") +
      `\n\n🔹 Gelo Normal (${fila.normal.length}/${LIMITE_SUBFILA}):\n` +
      (usuariosNormal.length ? usuariosNormal.join("\n") : "Nenhum")
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
      .setLabel("💸 Gelo Infinito")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`normal_${valor}`)
      .setLabel("🔹 Gelo Normal")
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
      console.log("✅ Comandos registrados globalmente (até 1h para aparecer)");
    }
  } catch (err) {
    console.error("Erro ao registrar comandos:", err);
  }
});

// ================= FUNÇÃO CRIAR CANAL COM RESET =================
async function criarCanalPartida(guild, valor, tipo, jogadores) {
  const nomeCanal = `💸 ${tipo.toUpperCase()} R$${valor}`;

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

  // Remove jogadores da fila
  filas[valor][tipo] = filas[valor][tipo].filter(id => !jogadores.includes(id));

  // ===== RESET AUTOMÁTICO DA PARTIDA =====
  setTimeout(async () => {
    jogadores.forEach(id => {
      userStatus.set(id, null);
    });

    if (canal && canal.deletable) {
      await canal.delete().catch(() => {});
    }

    console.log(`⚡ Partida R$${valor} (${tipo}) finalizada e jogadores liberados.`);
  }, TEMPO_PARTIDA);
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
        embeds: [criarEmbed(valor, client)],
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

    // ===== BLOQUEIO DE STATUS =====
    if (tipo !== "sair") {
      if (userStatus.get(userId) === "partida") {
        return await interaction.reply({ content: "❌ Você já está em uma partida e não pode entrar em outra.", ephemeral: true });
      }
    }

    // Remove usuário de ambas subfilas
    filas[valor].infinito = filas[valor].infinito.filter(id => id !== userId);
    filas[valor].normal = filas[valor].normal.filter(id => id !== userId);

    // Limpa timer antigo se existir
    if (queueTimers.has(userId)) {
      clearTimeout(queueTimers.get(userId));
      queueTimers.delete(userId);
    }

    // ===== ADICIONA NA FILA =====
    if (tipo === "infinito") {
      filas[valor].infinito.push(userId);
      userStatus.set(userId, "fila");
    } else if (tipo === "normal") {
      filas[valor].normal.push(userId);
      userStatus.set(userId, "fila");
    } else if (tipo === "sair") {
      userStatus.set(userId, null);
      return await interaction.update({
        embeds: [criarEmbed(valor, client)],
        components: [criarBotoes(valor)]
      });
    }

    // ===== TIMER DE 5 MIN =====
    const subfila = filas[valor][tipo];
    const timer = setTimeout(async () => {
      filas[valor][tipo] = filas[valor][tipo].filter(id => id !== userId);
      userStatus.set(userId, null);
      queueTimers.delete(userId);
      try {
        await interaction.followUp({ content: `⏱️ ${interaction.user.username} foi removido da fila após 5 minutos.`, ephemeral: true });
        await interaction.editReply({ embeds: [criarEmbed(valor, client)], components: [criarBotoes(valor)] });
      } catch {}
    }, 5 * 60 * 1000);
    queueTimers.set(userId, timer);

    // ===== CRIA PARTIDA SE SUBFILA CHEIA =====
    if (subfila.length >= LIMITE_SUBFILA) {
      subfila.forEach(id => {
        userStatus.set(id, "partida");
        clearTimeout(queueTimers.get(id));
        queueTimers.delete(id);
      });

      await criarCanalPartida(interaction.guild, valor, tipo, [...subfila]);
    }

    // ===== ATUALIZA EMBED =====
    await interaction.update({
      embeds: [criarEmbed(valor, client)],
      components: [criarBotoes(valor)]
    });
  }
});

client.login(TOKEN);