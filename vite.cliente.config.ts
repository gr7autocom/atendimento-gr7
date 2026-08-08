import { defineConfig } from 'vite'
import { configDoApp } from './vite.config'

/*
  Segunda passada do build: o PWA do cliente, que sai em `dist/suporte/`.

  Existe como arquivo separado, e não como `--mode cliente`, porque `--mode`
  no Vite também escolhe qual `.env` é carregado. Com `--mode cliente` o
  `.env.production` deixaria de ser lido, e é ele que força `NODE_ENV=production`
  neste projeto (ver o próprio arquivo: sem isso o build sai em modo
  desenvolvimento e apaga o registro do service worker). O `--config` troca só
  a configuração, que é o que se quer aqui.
*/
export default defineConfig(configDoApp('cliente'))
