//CONEXÃO E IMPORTAÇÃO - NÃO APAGAR
//base de dados e serviço de autenticação
import { db, auth } from "./firebase-config.js";
//métodos firestore
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
//firebase authentication
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { verificarOuCriarPerfil, carregarStatus, ganharRecompensa } from "./player.js";

//Armazenar o cancelamento do ouvinte em tempo real do Firestore
let desinscreverMural = null;
//Guardando as missões na memória para os filtros
let listaMissoes = [];

//cartela de cores categoria
const coresCategoria = {
    "mago": "bg-info text-dark", // Azul arcano / ciano
    "guerreiro": "bg-danger text-light", // Vermelho sangue/combate
    "ladino": "bg-dark text-light", // Sombra / furtividade
    "clerigo": "bg-warning text-dark" // Dourado / luz sagrada
};

//cartela de cores dificuldade
const coresDificuldade = {
    "comum": "bg-secondary text-light", // Cinza neutro
    "raro": "bg-primary text-light", // Azul vibrante
    "lendario": "bg-warning text-dark fw-bold" // Dourado
};

const coresFrequencia = {
    "unica": "bg-success text-light",
    "diaria": "bg-primary text-light",
    "semanal": "bg-primary text-light"
};

//--- CRIAR MISSÕES
function missoes() {
    let form = document.getElementById("forja");
    form.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        //trava de segurança
        if (!auth.currentUser) {
            alert("Necessário autenticação para forjar uma missão!");
            return;
        }

        //pegando os valores dos inputs
        let nome = document.getElementById("missao").value;
        let dificuldade = document.getElementById("dificuldade").value;
        let categoria = document.getElementById("categoria").value;
        let frequencia = document.getElementById("frequencia").value;

        try {
            let docRef = await addDoc(collection(db, 'missoes'), {
                titulo: nome,
                dificuldade: dificuldade,
                categoria: categoria,
                concluida: false,
                status: "pendente",
                criadaEm: new Date(),
                usuarioId: auth.currentUser.uid,
                frequencia: frequencia,
                ultimaConclusao: null
            });
            console.log("Missão salva na nuvem! ID:", docRef.id);
            form.reset();
        } catch (erro) {
            console.error("Erro ao gravar a missão no Firestore!", erro);
            alert("Não foi possível salvar a missão. Tente novamente.");
        }
    });
}

//--- LISTAR MISSÕES
function listarMissoes(usuarioId) {
    let consulta = query(collection(db, "missoes"), where("usuarioId", "==", usuarioId));

    if (desinscreverMural) {
        desinscreverMural();
    }

    desinscreverMural = onSnapshot(consulta, (snapshot) => {
        console.log("O mural foi atualizado na nuvem!");
        listaMissoes = [];

        snapshot.forEach((doc) => {
            listaMissoes.push({ id: doc.id, ...doc.data() });
        });

        renderizarMural();
    });
}

//--- RENDERIZAR MURAL
function renderizarMural() {
    let areaCards = document.getElementById("area-cards");
    areaCards.innerHTML = "";

    let valorFrequencia = document.getElementById("filtro-frequencia").value;
    let valorStatus = document.getElementById("filtro-status").value;

    let missoesFiltradas = listaMissoes.filter((missao) => {
        let statusMissao = missao.status || (missao.concluida ? "concluida" : "pendente");
        let passaFrequencia = valorFrequencia === "todas" || (missao.frequencia || "unica") === valorFrequencia;

        let passaStatus = valorStatus === "todos" ||
            (valorStatus === "pendentes" && statusMissao === "pendente") ||
            (valorStatus === "execucao" && statusMissao === "execucao") ||
            (valorStatus === "concluidos" && statusMissao === "concluida");

        return passaFrequencia && passaStatus;
    });

    missoesFiltradas.forEach((missao) => {
        let corCategoria = coresCategoria[missao.categoria?.toLowerCase()] || "bg-secondary";
        let dificuldadeFormatada = missao.dificuldade ? missao.dificuldade.toLowerCase() : "";
        let corDificuldade = coresDificuldade[dificuldadeFormatada] || "bg-secondary";
        let frequencia = missao.frequencia || "unica";
        let corFrequencia = coresFrequencia[frequencia] || "bg-secondary";
        let dataCriacao = missao.criadaEm ? missao.criadaEm.toDate().toLocaleDateString("pt-BR") : "";
        let textoRiscado = missao.concluida ? "text-decoration-line-through text-muted" : "";
        let textoBotao = missao.concluida ? "Desmarcar" : "Concluir";
        let estiloBotao = missao.concluida ? "btn-outline-secondary" : "btn-outline-success";
        let bordaExecucao = missao.status === "execucao" ? "border-start border-warning border-4" : "";

        areaCards.innerHTML += `
            <div class="col-12 col-md-6 col-lg-4 mb-3">
                <div class="card p-3 shadow-sm h-100 ${bordaExecucao}">
                    <small class="text-muted mb-1">
                        Criada em: ${dataCriacao}
                    </small>
                    <h5 class="card-title ${textoRiscado}">${missao.titulo}</h5>
                    <div class="mt-2">
                        <span class="badge ${corCategoria}">${missao.categoria}</span>
                        <span class="badge ${corDificuldade}">${missao.dificuldade}</span>
                        <span class="badge ${corFrequencia}">${frequencia}</span>
                    </div>
                    <div class="d-flex gap-2 mt-3">
                        <button class="btn-concluir btn btn-sm ${estiloBotao}" data-id="${missao.id}" data-status="${missao.concluida}" data-dificuldade="${missao.dificuldade}" data-categoria="${missao.categoria}">${textoBotao} </button>
                        <button class="btn-execucao btn btn-sm btn-outline-warning" data-id="${missao.id}">Em execução</button>
                        <button class="btn-excluir btn btn-sm btn-outline-danger" data-id="${missao.id}">Excluir</button>
                    </div>
                </div>
            </div>`;
    });
}

//--- GERENCIAR FILTRO
function gerenciarFiltro() {

    let filtroFrequencia = document.getElementById("filtro-frequencia");
    let filtroStatus = document.getElementById("filtro-status");

    filtroFrequencia.addEventListener("change", renderizarMural);
    filtroStatus.addEventListener("change", renderizarMural);
}

//--- GERENCIAMENTO DA ÁREA-CARDS
function gerenciarAcoesMural() {
    let mural = document.getElementById("area-cards");
    mural.addEventListener("click", async function (evento) {
        let elementoClicado = evento.target;
        let id = elementoClicado.getAttribute("data-id");

        // concluir
        if (elementoClicado.classList.contains("btn-concluir")) {
            let statusAtual = (elementoClicado.getAttribute("data-status") === "true");
            let novoStatus = !statusAtual;
            let dificuldade = elementoClicado.getAttribute("data-dificuldade");
            let categoria = elementoClicado.getAttribute("data-categoria");

            try {
                let missaoRef = doc(db, "missoes", id);
                await updateDoc(missaoRef, { concluida: novoStatus });

                // Entrega a recompensa apenas quando a missão é marcada como concluída
                if (novoStatus && auth.currentUser) {
                    await ganharRecompensa(auth.currentUser.uid, dificuldade, categoria);
                    carregarStatus(auth.currentUser.uid); // Atualiza o status/XP na tela
                }
                console.log("Status atualizado no Firebase com sucesso!");
            } catch (erro) {
                console.error("Erro ao atualizar no Firebase:", erro);
            }
        }

        // em execução
        if (elementoClicado.classList.contains("btn-execucao")) {
            try {
                let missaoRef = doc(db, "missoes", id);
                await updateDoc(missaoRef, {
                    status: "execucao",
                    concluida: false
                });
                console.log("Missão marcada como em execução! ID:", id);
            } catch (erro) {
                console.error("Erro ao colocar missão em execução:", erro);
            }
        }

        // excluir
        if (elementoClicado.classList.contains("btn-excluir")) {
            try {
                let missaoRef = doc(db, "missoes", id);
                await deleteDoc(missaoRef);
                console.log("Missão eliminada com sucesso! ID:", id);
            } catch (erro) {
                console.error("Erro ao eliminar a missão:", erro);
            }
        }
    });
}

//--- GERENCIAMENTO DA AUTENTICAÇÃO DO USUÁRIO
function gerenciarAutenticacao() {
    let landingView = document.getElementById("landing-view");
    let appView = document.getElementById("app-view");
    let botoesLogin = document.querySelectorAll(".js-btn-login");
    let btnLogout = document.getElementById("btn-logout");
    let infoUsuario = document.getElementById("info-usuario");
    let provedorGoogle = new GoogleAuthProvider();

    // Função única para abrir o pop-up do Google
    async function fazerLoginGoogle() {
        try {
            await signInWithPopup(auth, provedorGoogle);
            console.log("Login realizado com sucesso!");
        } catch (erro) {
            console.error("Erro ao fazer login:", erro);
        }
    }

    botoesLogin.forEach((botao) => {
        botao.addEventListener("click", fazerLoginGoogle);
    });

    // Ação de Sair
    btnLogout.addEventListener("click", async function () {
        try {
            await signOut(auth);
            console.log("Sessão encerrada com sucesso!");
        } catch (erro) {
            console.error("Erro ao encerrar sessão:", erro);
        }
    });

    // Atualiza a interface automaticamente
    onAuthStateChanged(auth, async (usuario) => {
        if (usuario) {
            // Coloca a foto redondinha e o nome na barra superior
            infoUsuario.innerHTML = `
                <img src="${usuario.photoURL}" alt="${usuario.displayName}" class="rounded-circle" width="30" height="30" style="border: 2px solid var(--destaque-ciano);">
                <span class="small fw-semibold text-light">${usuario.displayName}</span>
            `;

            // Verifica ou cria a ficha primeiro
            await verificarOuCriarPerfil(usuario);
            carregarStatus(usuario.uid);

            // Lista as missões
            listarMissoes(usuario.uid);

            // Troca para a tela da aplicação
            landingView.classList.add("d-none");
            appView.classList.remove("d-none");
        } else {
            // Se NÃO tem ninguém logado (ou se deslogou):
            infoUsuario.innerHTML = "";
            document.getElementById("area-cards").innerHTML = "";

            // Desliga a escuta se houver alguma rodando
            if (desinscreverMural) {
                desinscreverMural();
            }

            // Volta para a tela inicial 
            landingView.classList.remove("d-none");
            appView.classList.add("d-none");
        }
    });
}

//chamando eventos
missoes();
gerenciarAcoesMural();
gerenciarAutenticacao();
gerenciarFiltro();