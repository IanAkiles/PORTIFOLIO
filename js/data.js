// Fonte da verdade dos projetos. Capas e links reais preservados.
const PROJECTS = [
  {
    "titulo": "Rede Neural Quântica",
    "site": "Quantico Alfa",
    "categoria": "Pesquisa",
    "subtitulo": "Estrutura de uma rede neural quântica",
    "descricao": "Apresentação de uma estrutura de Rede Neural Quântica, em andamento.",
    "tags": [
      "Canva",
      "Redes de computadores"
    ],
    "url": "https://quanticoalfa.netlify.app/",
    "periodo": "jan. 2026 – atual",
    "instituicao": "Anhanguera Educacional",
    "capa": "rede neural.jfif",
    "aspecto": 1.745,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/living-portrait-hero.mp4",
    "manutencao": false
  },
  {
    "titulo": "Portfólio IAN LAB",
    "site": "IAN LAB",
    "categoria": "Portfólio",
    "subtitulo": "Desenvolvedor de experiências digitais e sistemas experimentais",
    "descricao": "Meu laboratório digital: web, interfaces técnicas, arquitetura de sistemas e produtos com alta densidade de informação. Projetar rápido, testar sem medo e estressar os limites de usabilidade até o sistema quebrar, porque daí vem o aprendizado.",
    "tags": [
      "Web",
      "Interfaces técnicas",
      "Sistemas"
    ],
    "url": "https://ianakiles.com.br/",
    "periodo": "jan. 2026 – set. 2026",
    "instituicao": "Anhanguera Educacional",
    "capa": "ian akiles dev.jfif",
    "aspecto": 1.7,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/mossline-hero.mp4",
    "manutencao": true
  },
  {
    "titulo": "Sua Trilha — TI",
    "site": "Introdução Lab TI",
    "categoria": "Edtech",
    "subtitulo": "Plataforma gamificada de aprendizado em TI",
    "descricao": "O usuário percorre uma trilha de conhecimento, completa lições e quizzes para acumular XP, subir de nível e desbloquear conquistas. Nasceu da vontade de transformar o estudo técnico, que costuma ser árido, em uma experiência com progressão visível e recompensas constantes.",
    "tags": [
      "React.js",
      "Node.js"
    ],
    "url": "https://introducaolabti.netlify.app/",
    "periodo": "jul. 2026 – set. 2026",
    "instituicao": "Cedaspy Manaus Centro",
    "capa": "trilha aprendizado.jfif",
    "aspecto": 1.735,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/fernhollow.mp4",
    "manutencao": false
  },
  {
    "titulo": "Retro Pixel Studio Pro",
    "site": "Retro Pixel Studio",
    "categoria": "Pixel art",
    "subtitulo": "Criação de pixel art inspirada nos anos 80 e 90",
    "descricao": "Ferramenta inspirada nas máquinas clássicas do início dos anos 90 e dos 80, pensada para uma experiência nostálgica que permite trabalhar com a fidelidade das limitações técnicas de consoles e computadores retrô.",
    "tags": [
      "HTML5",
      "JavaScript"
    ],
    "url": "https://retrostudiobyakiles.netlify.app/",
    "periodo": "jun. 2026 – ago. 2026",
    "instituicao": "Anhanguera Educacional",
    "capa": "retro pixel.jfif",
    "aspecto": 1.837,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/vell-lookbook.mp4",
    "manutencao": false
  },
  {
    "titulo": "Treino Explorer",
    "site": "Explorer Treino",
    "categoria": "Edtech",
    "subtitulo": "Treinamento interativo do Explorador de Arquivos",
    "descricao": "Página única para iniciantes aprenderem o Explorador de Arquivos do Windows, juntando teoria e prática, sem instalação nem servidor. Quem está começando aprende melhor entendendo o conceito e já colocando a mão na massa.",
    "tags": [
      "HTML5",
      "JavaScript"
    ],
    "url": "https://explorertreino.netlify.app/",
    "periodo": "mai. 2026 – jun. 2026",
    "instituicao": "Cedaspy Manaus Centro",
    "capa": "treino explorer.jfif",
    "aspecto": 1.526,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/vasari-vhs-hero.mp4",
    "manutencao": false
  },
  {
    "titulo": "Quiz: Meu Computador",
    "site": "Quiz de Informática",
    "categoria": "Edtech",
    "subtitulo": "Quiz de informática para iniciantes",
    "descricao": "Primeiro contato seguro e didático com o computador, sem pressão de tempo. 20 perguntas em três pilares: introdução ao computador, pastas e subpastas, e teclas de atalho.",
    "tags": [
      "HTML5",
      "CSS"
    ],
    "url": "https://quiziti.netlify.app/",
    "periodo": "abr. 2026",
    "instituicao": "Cedaspy Manaus Centro",
    "capa": "quiz informatica.jfif",
    "aspecto": 1.658,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/lumen-roof-hero.mp4",
    "manutencao": false
  },
  {
    "titulo": "BarberPro",
    "site": "Borges Barber",
    "categoria": "Sistema",
    "subtitulo": "Sistema de gestão completo para barbearias",
    "descricao": "Criado para simplificar o dia a dia de barbeiros, com design limpo e intuitivo que coloca as informações mais importantes no Dashboard, logo na tela inicial.",
    "tags": [
      "Dashboard",
      "Gestão"
    ],
    "url": "https://borgesbarber.netlify.app/",
    "periodo": "jun. 2025 – out. 2025",
    "instituicao": "Anhanguera Educacional",
    "capa": "barber pro.jfif",
    "aspecto": 1.33,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/designs/honey-bee-melli-landing.mp4",
    "manutencao": false
  },
  {
    "titulo": "Sistema de Partículas",
    "site": "Modelador de Partículas",
    "categoria": "WebGPU",
    "subtitulo": "Simulação de 5.000 partículas em formações paramétricas",
    "descricao": "Motor de simulação visual em que 5.000 partículas se organizam em formações matemáticas paramétricas, animadas a 60 FPS constantes. A interface mostra o estado atual e troca de padrão com um clique.",
    "tags": [
      "Three.js",
      "WebGPU"
    ],
    "url": "https://modeladordeparticulas.netlify.app/",
    "periodo": "mar. 2025 – abr. 2025",
    "instituicao": "Anhanguera Educacional",
    "capa": "sistemas particula.jfif",
    "aspecto": 1.61,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/found-spider.mp4",
    "manutencao": false
  },
  {
    "titulo": "Burn",
    "site": "Black Hole Visualization",
    "categoria": "WebGL",
    "subtitulo": "Visualização interativa de um buraco negro",
    "descricao": "Experiência visual em WebGL com uma simulação interativa de um buraco negro, controles de visualização e renderização em tempo real.",
    "tags": [
      "HTML",
      "JavaScript",
      "WebGL"
    ],
    "url": "burn/index.html",
    "periodo": "2026",
    "instituicao": "Projeto autoral",
    "capa": "buraco negro.png",
    "aspecto": 1.745,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/living-portrait-hero.mp4",
    "manutencao": false
  },
  {
    "titulo": "Vida de uma Singularidade",
    "site": "Vida Singularidade",
    "categoria": "Simulação",
    "subtitulo": "Telemetria de um buraco negro estelar",
    "descricao": "Nasceu da vontade de transformar dados brutos de astrofísica em algo que se sente na tela: um painel de telemetria minimalista, quase poético, que mostra o estado de um objeto compacto como o display de uma sonda caindo rumo ao horizonte de eventos.",
    "tags": [
      "WebGL",
      "JavaScript"
    ],
    "url": "https://vidasingularidade.netlify.app/",
    "periodo": "",
    "instituicao": "Anhanguera Educacional",
    "capa": "vida singularidade.jfif",
    "aspecto": 1.7,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/mossline-hero.mp4",
    "manutencao": false
  },
  {
    "titulo": "Garimpo Tech",
    "site": "Garimpo Landing Page",
    "categoria": "Tecnologia",
    "subtitulo": "Descobertas para o seu universo tech",
    "descricao": "Landing page de curadoria que reúne descobertas, ferramentas e referências do universo tech em um só lugar, sem excesso de ruído.",
    "tags": [
      "Web"
    ],
    "url": "https://ianakiles.github.io/garimpo_landingpage/",
    "periodo": "",
    "instituicao": "Projeto autoral",
    "capa": "garimpo-tech.jpg",
    "aspecto": 1.735,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/fernhollow.mp4",
    "manutencao": false
  },
  {
    "titulo": "StudyFlow",
    "site": "StudyFlow",
    "categoria": "Estudos",
    "subtitulo": "Mais direção para sua rotina de estudos",
    "descricao": "Página de apresentação de uma proposta para organizar a rotina de estudos com mais direção, foco e clareza sobre o que fazer em seguida.",
    "tags": [
      "Web"
    ],
    "url": "https://ianakiles.github.io/Studyflow/?v=9b729c2",
    "periodo": "",
    "instituicao": "Projeto autoral",
    "capa": "studyflow.jpg",
    "aspecto": 1.837,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/vell-lookbook.mp4",
    "manutencao": false
  },
  {
    "titulo": "RECALL",
    "site": "RECALL",
    "categoria": "Organização",
    "subtitulo": "Ideias e projetos sempre por perto",
    "descricao": "Interface pensada para manter ideias, referências e projetos reunidos e sempre à mão, reduzindo o atrito entre ter uma ideia e voltar a ela.",
    "tags": [
      "Web"
    ],
    "url": "https://ianakiles.github.io/RECALL/",
    "periodo": "",
    "instituicao": "Projeto autoral",
    "capa": "recall.jpg",
    "aspecto": 1.526,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/vasari-vhs-hero.mp4",
    "manutencao": false
  },
  {
    "titulo": "Trilha de Sistemas",
    "site": "Trilha de Sistemas",
    "categoria": "Aprendizado",
    "subtitulo": "Um caminho para desenvolver conhecimento",
    "descricao": "Trilha de aprendizado que organiza conteúdos de sistemas em uma progressão visível, para tornar o estudo técnico menos disperso.",
    "tags": [
      "Web"
    ],
    "url": "https://ianakiles.github.io/trilha_aprendizado/",
    "periodo": "",
    "instituicao": "Projeto autoral",
    "capa": "trilha-sistemas.jpg",
    "aspecto": 1.658,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/lumen-roof-hero.mp4",
    "manutencao": false
  },
  {
    "titulo": "Seu Próximo Projeto",
    "site": "Página de Orçamento",
    "categoria": "Orçamento",
    "subtitulo": "O primeiro passo começa com um orçamento",
    "descricao": "Página para transformar uma ideia em conversa: o visitante entende o processo e dá o primeiro passo para tirar o projeto do papel.",
    "tags": [
      "Web"
    ],
    "url": "https://ianakiles.github.io/pagina_or-amento/",
    "periodo": "",
    "instituicao": "Projeto autoral",
    "capa": "orcamento.jpg",
    "aspecto": 1.33,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/designs/honey-bee-melli-landing.mp4",
    "manutencao": false
  },
  {
    "titulo": "RetroStudio",
    "site": "RetroStudio",
    "categoria": "Criatividade",
    "subtitulo": "Uma nova perspectiva com alma retrô",
    "descricao": "Experiência web que aplica uma estética retrô à criação visual, com uma interface que valoriza textura, limitação e nostalgia.",
    "tags": [
      "Web"
    ],
    "url": "https://ianakiles.github.io/retro_studio/",
    "periodo": "",
    "instituicao": "Projeto autoral",
    "capa": "retro-studio.jpg",
    "aspecto": 1.61,
    "video": "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/found-spider.mp4",
    "manutencao": false
  }
];
