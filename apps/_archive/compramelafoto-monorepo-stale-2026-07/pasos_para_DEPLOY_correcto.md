# Pasos para DEPLOY correcto

> **Regla obligatoria para staging/prod (DB compartida):** usar solo  
> `pnpm --filter @repo/db run db:migrate:deploy`  
> No usar `db push` en staging/prod.

## 1) Preparar cambios
- Verifica que todo funcione localmente.
- Si tocaste base de datos, aplicá migraciones de forma segura:
```
pnpm --filter @repo/db run db:migrate:deploy
pnpm --filter @repo/db run db:generate
```

## 2) Build local (para anticipar errores)
```
npm run build
```
Si falla, corrige antes de subir.

## 3) Commit + Push
```
git status
git add .
git commit -m "tu mensaje"
git push origin main
```

## 4) Verificar deploy en Vercel
- Vercel → Deployments
- Busca el último commit y revisa que esté en verde.

## 5) Si Vercel marca error de email del autor
Configura el email (solo en este repo):
```
git config user.name "Daniel Cuart"
git config user.email "compramelafoto@gmail.com"
```

Si necesitás forzar un deploy:
```
git commit --allow-empty -m "trigger deploy"
git push origin main
```

## 6) Checklist rápido de pruebas
- Login admin/fotógrafo/lab
- Crear álbum y abrir `/a/slug`
- Imprimir: subir fotos y configurar producto/tamaño/acabado
- Verificar preview/slide
- Probar flujo de compra básico
