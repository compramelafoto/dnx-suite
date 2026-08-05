-- Quita registros fantasma/fallidos en _prisma_migrations para desbloquear P3009 / P3018 en deploy (Vercel).
-- Migraciones aplicadas OK (checksum + finished_at coherente) no deben entrar aquí salvo filtros muy acotados.
-- Tras el DELETE, migrate deploy vuelve a ejecutar la migración (SQL idempotente donde aplica).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
  ) THEN
    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260319042145_init'
      AND finished_at IS NULL;

    -- Baseline fantasma (carpeta ya no existe en el repo); bloqueaba P3009 en deploy.
    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260422085720_init_baseline'
      AND finished_at IS NULL;

    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260329120000_preventa_canjeable_v1_phase1'
      AND finished_at IS NULL;

    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260401120000_webhook_event_idempotency_per_status'
      AND finished_at IS NULL;

    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260402120000_orderitem_entitlement_id_idx'
      AND finished_at IS NULL;

    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260428120000_benefit_regular_unit_price_after_preventa'
      AND finished_at IS NULL;

    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260208173000_add_talks_module'
      AND finished_at IS NULL;

    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260515140000_event_organizer_commission_snapshot'
      AND finished_at IS NULL;

    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260518153000_event_folder'
      AND (
        finished_at IS NULL
        OR logs ILIKE '%A migration failed to apply%'
        OR logs ILIKE '%P3018%'
        OR logs ILIKE '%42P07%'
        OR logs ILIKE '%EventFolder%already exists%'
      );

    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260520101500_photo_event_folder_id'
      AND finished_at IS NULL;

    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20260615130000_referral_earning_sale_ref_attribution_unique'
      AND (
        finished_at IS NULL
        OR logs ILIKE '%A migration failed to apply%'
        OR logs ILIKE '%P3018%'
        OR logs ILIKE '%23505%'
        OR logs ILIKE '%ReferralEarning_saleRef_attributionId_key%'
      );
  END IF;
END $$;
