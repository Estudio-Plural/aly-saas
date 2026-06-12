-- ============================================================================
-- 004 — Seed extra para el inbox de Conversaciones (idempotente)
-- Conversaciones de ejemplo con análisis (summary/keywords/flags) para que
-- la página Conversaciones muestre el valor del producto en la demo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DEMO: conversación con flag de alta severidad (Carla Gómez ya existe en 003)
-- ----------------------------------------------------------------------------

INSERT INTO users_interactions (workspace_id, conversation_id, client_number, role, message, status, timestamp, created_at)
SELECT w.id, v.conversation_id, v.client_number, v.role, v.message, 'closed',
       NOW() - v.ts_offset, NOW() - v.ts_offset
FROM workspaces w,
  (VALUES
    ('conv-seed-003', '+5491100000003', 'user',      'Hola, me cobraron dos veces la cuota de este mes', INTERVAL '26 hours'),
    ('conv-seed-003', '+5491100000003', 'assistant', 'Hola Carla, lamento mucho eso. ¿Me pasás los últimos 4 dígitos de la tarjeta para verificarlo?', INTERVAL '26 hours' - INTERVAL '1 minute'),
    ('conv-seed-003', '+5491100000003', 'user',      'Termina en 4821. Necesito que me devuelvan la plata, ya es la segunda vez', INTERVAL '26 hours' - INTERVAL '3 minutes'),
    ('conv-seed-003', '+5491100000003', 'assistant', 'Entiendo tu molestia y tenés razón en reclamar. Ya derivé tu caso al equipo de facturación con prioridad alta: te van a contactar hoy mismo para gestionar el reembolso.', INTERVAL '26 hours' - INTERVAL '4 minutes')
  ) AS v(conversation_id, client_number, role, message, ts_offset)
WHERE w.slug = 'demo'
  AND NOT EXISTS (
    SELECT 1 FROM users_interactions ui
    WHERE ui.workspace_id = w.id AND ui.conversation_id = v.conversation_id AND ui.message = v.message
  );

INSERT INTO conversations_data (workspace_id, conversation_id, user_number, conversation_date, summary, keywords, flags, flag_severity, messages_count)
SELECT w.id, 'conv-seed-003', '+5491100000003', CURRENT_DATE - 1,
       'Usuaria reporta un cobro duplicado por segunda vez y exige reembolso. Se derivó a facturación con prioridad alta.',
       ARRAY['cobro duplicado', 'reembolso', 'reclamo'],
       'HIGH-Cobro duplicado reiterado, usuaria molesta, requiere seguimiento de facturación',
       'HIGH', 4
FROM workspaces w
WHERE w.slug = 'demo'
ON CONFLICT (workspace_id, conversation_id) DO NOTHING;

-- Keywords para las conversaciones seed de 003 (no tenían)
UPDATE conversations_data cd
SET keywords = v.keywords
FROM (VALUES
    ('conv-seed-001', ARRAY['horarios', 'atención']),
    ('conv-seed-002', ARRAY['inscripción', 'curso'])
  ) AS v(conversation_id, keywords)
WHERE cd.conversation_id = v.conversation_id
  AND cd.keywords IS NULL
  AND cd.workspace_id = (SELECT id FROM workspaces WHERE slug = 'demo');

-- ----------------------------------------------------------------------------
-- APAPACHAR: usuarios y conversaciones (una cerrada con análisis, una abierta)
-- ----------------------------------------------------------------------------

INSERT INTO users_data (workspace_id, number, name, country, user_language)
SELECT w.id, v.number, v.name, 'AR', 'es'
FROM workspaces w,
  (VALUES
    ('+5491155550001', 'Lucía Fernández'),
    ('+5491155550002', 'Marcos Díaz')
  ) AS v(number, name)
WHERE w.slug = 'apapachar'
ON CONFLICT (workspace_id, number) DO NOTHING;

INSERT INTO users_interactions (workspace_id, conversation_id, client_number, role, message, status, timestamp, created_at)
SELECT w.id, v.conversation_id, v.client_number, v.role, v.message, v.status,
       NOW() - v.ts_offset, NOW() - v.ts_offset
FROM workspaces w,
  (VALUES
    ('conv-apa-001', '+5491155550001', 'user',      'Hola Apa! Quería saber cómo arranco con el programa', 'closed', INTERVAL '2 days'),
    ('conv-apa-001', '+5491155550001', 'assistant', '¡Hola Lucía! Qué bueno tenerte acá. El primer paso es una sesión de bienvenida: ¿te queda bien esta semana?', 'closed', INTERVAL '2 days' - INTERVAL '1 minute'),
    ('conv-apa-001', '+5491155550001', 'user',      'Sí! El jueves a la tarde puedo', 'closed', INTERVAL '2 days' - INTERVAL '2 minutes'),
    ('conv-apa-001', '+5491155550001', 'assistant', 'Listo, te agendé para el jueves a las 17hs. Un día antes te mando un recordatorio por acá 💛', 'closed', INTERVAL '2 days' - INTERVAL '3 minutes'),
    ('conv-apa-002', '+5491155550002', 'user',      'Buenas! ¿Tienen algún plan para regalar?', 'open', INTERVAL '2 hours'),
    ('conv-apa-002', '+5491155550002', 'assistant', '¡Hola Marcos! Sí, tenemos gift cards del programa. ¿Es para alguien en particular? Así te recomiendo la mejor opción.', 'open', INTERVAL '2 hours' - INTERVAL '1 minute')
  ) AS v(conversation_id, client_number, role, message, status, ts_offset)
WHERE w.slug = 'apapachar'
  AND NOT EXISTS (
    SELECT 1 FROM users_interactions ui
    WHERE ui.workspace_id = w.id AND ui.conversation_id = v.conversation_id AND ui.message = v.message
  );

INSERT INTO conversations_data (workspace_id, conversation_id, user_number, conversation_date, summary, keywords, messages_count)
SELECT w.id, 'conv-apa-001', '+5491155550001', CURRENT_DATE - 2,
       'Usuaria nueva consulta cómo empezar; se agendó sesión de bienvenida para el jueves 17hs.',
       ARRAY['bienvenida', 'agenda', 'sesión'],
       4
FROM workspaces w
WHERE w.slug = 'apapachar'
ON CONFLICT (workspace_id, conversation_id) DO NOTHING;
