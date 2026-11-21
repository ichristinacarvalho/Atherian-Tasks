//Base de dados
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

//Função principal
export async function verificarOuCriarPerfil(usuario) {

    let refPlayer = doc(db, "players", usuario.uid); //referencia do banco de dados

    let perfilSnap = await getDoc(refPlayer); //leitura do db

    if (!perfilSnap.exists()) { //criação do personagem
        await setDoc(refPlayer, {
            nivel: 1,
            xpAtual: 0,
            xpProximo: 100,
            hp: 100,

            atributos: {
                guerreiro: 0,
                mago: 0,
                ladino: 0,
                clerigo: 0
            }
        });
        console.log("Ficha de herói forjada com sucesso no banco de dados!");
    }
}

export function carregarStatus(uid) {

    let refStatus = doc(db, "players", uid); //referencia do banco de dados

    onSnapshot(refStatus, (docSnap) => {
        let dados = docSnap.data();

        document.getElementById("status-nivel").textContent = dados.nivel;
        document.getElementById("status-xp-atual").textContent = dados.xpAtual;
        document.getElementById("status-xp-proximo").textContent = dados.xpProximo;
        document.getElementById("status-hp").textContent = dados.hp;
        document.getElementById("attr-guerreiro").textContent = dados.atributos?.guerreiro || 0;
        document.getElementById("attr-mago").textContent = dados.atributos?.mago || 0;
        document.getElementById("attr-ladino").textContent = dados.atributos?.ladino || 0;
        document.getElementById("attr-clerigo").textContent = dados.atributos?.clerigo || 0;
    });
}

export async function ganharRecompensa(uid, dificuldade, categoria) {

    let refPlayer = doc(db, "players", uid);

    let perfilSnap = await getDoc(refPlayer);
    let dados = perfilSnap.data();

    let xpGanho = 0;

    if (dificuldade === "lendario") {
        xpGanho = 150;
    } else if (dificuldade === "raro") {
        xpGanho = 100;
    } else if (dificuldade === "comum") {
        xpGanho = 50;
    }

    let novoXp = dados.xpAtual + xpGanho;
    let novoNivel = dados.nivel;
    let novoXpProximo = dados.xpProximo;

    console.log(`A dificuldade era ${dificuldade}. Novo XP total será: ${novoXp}`);

    // Verifica se o jogador atingiu ou ultrapassou o XP necessário para subir de nível
    if (novoXp >= novoXpProximo) {
        novoNivel = novoNivel + 1;
        novoXp = novoXp - novoXpProximo;
        novoXpProximo = Math.floor(novoXpProximo * 1.5);
        console.log("🎉 LEVEL UP!");
    }

    let categoriaFormatada = categoria.toLowerCase();

    let atributoAtualizado = (dados.atributos?.[categoriaFormatada] || 0) + 1;

    await updateDoc(refPlayer, {
        xpAtual: novoXp,
        nivel: novoNivel,
        xpProximo: novoXpProximo,
        [`atributos.${categoriaFormatada}`]: atributoAtualizado
    });
}