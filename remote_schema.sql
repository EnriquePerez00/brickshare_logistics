


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."event_type_enum" AS ENUM (
    'qr_generated',
    'qr_scanned_success',
    'qr_scanned_failed',
    'qr_expired',
    'package_created',
    'status_changed',
    'manual_adjustment'
);


ALTER TYPE "public"."event_type_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."event_type_enum" IS 'Tipos de eventos de auditoría en el sistema de logística';



CREATE TYPE "public"."package_status" AS ENUM (
    'pending_dropoff',
    'in_location',
    'picked_up',
    'returned'
);


ALTER TYPE "public"."package_status" OWNER TO "postgres";


CREATE TYPE "public"."pudo_action_type" AS ENUM (
    'delivery_confirmation',
    'return_confirmation'
);


ALTER TYPE "public"."pudo_action_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_package_state_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Solo validar cuando el status cambia
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT public.validate_package_state_transition(OLD.status, NEW.status, NEW.type) THEN
      RAISE EXCEPTION 'Invalid state transition for % package: % -> %', 
        NEW.type, OLD.status, NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_package_state_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_audit_logs"("p_days_to_keep" integer DEFAULT 90) RETURNS TABLE("deleted_events" integer, "deleted_errors" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted_events INT := 0;
  v_deleted_errors INT := 0;
BEGIN
  DELETE FROM public.package_events
  WHERE created_at < now() - (p_days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted_events = ROW_COUNT;
  
  DELETE FROM public.scan_errors
  WHERE created_at < now() - (p_days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted_errors = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted_events, v_deleted_errors;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_audit_logs"("p_days_to_keep" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_audit_logs"("p_days_to_keep" integer) IS 'Purga registros de auditoría más antiguos que el período especificado. Ejecutar periódicamente (cron).';



CREATE OR REPLACE FUNCTION "public"."create_external_package"("p_tracking_code" "text", "p_type" "text", "p_location_id" "uuid", "p_customer_id" "uuid" DEFAULT NULL::"uuid", "p_external_shipment_id" "text" DEFAULT NULL::"text", "p_source_system" "text" DEFAULT 'brickshare'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_package_id UUID;
  v_result JSON;
BEGIN
  -- Validar que el location existe y está activo
  IF NOT EXISTS (
    SELECT 1 FROM public.locations 
    WHERE id = p_location_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Location not found or inactive: %', p_location_id;
  END IF;

  -- Validar tipo
  IF p_type NOT IN ('delivery', 'return') THEN
    RAISE EXCEPTION 'Invalid package type: %. Must be delivery or return', p_type;
  END IF;

  -- Crear el package
  INSERT INTO public.packages (
    tracking_code,
    type,
    status,
    location_id,
    customer_id,
    external_shipment_id,
    source_system
  ) VALUES (
    p_tracking_code,
    p_type,
    'pending_dropoff',
    p_location_id,
    p_customer_id,
    p_external_shipment_id,
    p_source_system
  )
  RETURNING id INTO v_package_id;

  -- Construir respuesta
  SELECT json_build_object(
    'success', true,
    'package_id', v_package_id,
    'tracking_code', p_tracking_code,
    'type', p_type,
    'status', 'pending_dropoff',
    'location_id', p_location_id,
    'created_at', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."create_external_package"("p_tracking_code" "text", "p_type" "text", "p_location_id" "uuid", "p_customer_id" "uuid", "p_external_shipment_id" "text", "p_source_system" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_external_package"("p_tracking_code" "text", "p_type" "text", "p_location_id" "uuid", "p_customer_id" "uuid", "p_external_shipment_id" "text", "p_source_system" "text") IS 'Crea un package desde un sistema externo. Requiere autenticación y permisos adecuados.';



CREATE OR REPLACE FUNCTION "public"."detect_scan_attack"("p_location_id" "uuid", "p_error_threshold" integer DEFAULT 10, "p_time_window_minutes" integer DEFAULT 5) RETURNS TABLE("location_id" "uuid", "error_count" integer, "ip_addresses" "text"[], "alert_level" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.location_id,
    COUNT(*)::INT as error_count,
    ARRAY_AGG(DISTINCT se.ip_address::TEXT ORDER BY se.ip_address::TEXT) as ip_addresses,
    CASE
      WHEN COUNT(*) >= p_error_threshold THEN 'HIGH'
      WHEN COUNT(*) >= p_error_threshold / 2 THEN 'MEDIUM'
      ELSE 'LOW'
    END as alert_level
  FROM public.scan_errors se
  WHERE
    se.location_id = p_location_id
    AND se.created_at > now() - (p_time_window_minutes || ' minutes')::INTERVAL
  GROUP BY se.location_id;
END;
$$;


ALTER FUNCTION "public"."detect_scan_attack"("p_location_id" "uuid", "p_error_threshold" integer, "p_time_window_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detect_scan_attack"("p_location_id" "uuid", "p_error_threshold" integer, "p_time_window_minutes" integer) IS 'Detecta potencial ataque analizando picos de errores de escaneo en una ventana temporal';



CREATE OR REPLACE FUNCTION "public"."export_pudo_operations_csv"("p_location_id" "uuid", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_action_type" "text" DEFAULT NULL::"text", "p_result_filter" "text" DEFAULT NULL::"text", "p_tracking_search" "text" DEFAULT NULL::"text") RETURNS TABLE("scan_timestamp" "text", "tracking_code" "text", "action_type_label" "text", "status_transition" "text", "result" "text", "operator_name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(psl.scan_timestamp, 'YYYY-MM-DD HH24:MI:SS') as scan_timestamp,
    psl.remote_shipment_id as tracking_code,
    CASE psl.action_type
      WHEN 'delivery_confirmation' THEN 'Entrega confirmada'
      WHEN 'return_confirmation' THEN 'Devolución recibida'
      ELSE psl.action_type::TEXT
    END as action_type_label,
    psl.previous_status || ' → ' || psl.new_status as status_transition,
    CASE 
      WHEN psl.api_request_successful THEN 'Éxito'
      ELSE 'Fallo'
    END as result,
    u.first_name || ' ' || u.last_name as operator_name
  FROM public.pudo_scan_logs psl
  JOIN public.users u ON u.id = psl.scanned_by_user_id
  WHERE psl.pudo_location_id = p_location_id
    AND (p_date_from IS NULL OR psl.scan_timestamp >= p_date_from)
    AND (p_date_to IS NULL OR psl.scan_timestamp <= p_date_to)
    AND (p_action_type IS NULL OR psl.action_type::TEXT = p_action_type)
    AND (
      p_result_filter IS NULL 
      OR (p_result_filter = 'success' AND psl.api_request_successful = true)
      OR (p_result_filter = 'failed' AND psl.api_request_successful = false)
    )
    AND (
      p_tracking_search IS NULL 
      OR psl.remote_shipment_id ILIKE '%' || p_tracking_search || '%'
    )
  ORDER BY psl.scan_timestamp DESC;
END;
$$;


ALTER FUNCTION "public"."export_pudo_operations_csv"("p_location_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_action_type" "text", "p_result_filter" "text", "p_tracking_search" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."export_pudo_operations_csv"("p_location_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_action_type" "text", "p_result_filter" "text", "p_tracking_search" "text") IS 'Exporta operaciones PUDO en formato compatible con CSV. El frontend debe convertir JSON a CSV.';



CREATE OR REPLACE FUNCTION "public"."generate_pudo_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.pudo_id IS NULL THEN
    NEW.pudo_id := 'brickshare-' || LPAD(nextval('locations_pudo_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_pudo_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_pudo_id"() IS 'Genera automáticamente un pudo_id en formato brickshare-XXX para nuevos puntos PUDO';



CREATE OR REPLACE FUNCTION "public"."get_pudo_operations_paginated"("p_location_id" "uuid", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_action_type" "text" DEFAULT NULL::"text", "p_result_filter" "text" DEFAULT NULL::"text", "p_tracking_search" "text" DEFAULT NULL::"text", "p_page" integer DEFAULT 1, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "scan_timestamp" timestamp with time zone, "tracking_code" "text", "action_type" "public"."pudo_action_type", "action_type_label" "text", "previous_status" "text", "new_status" "text", "status_transition" "text", "result" boolean, "operator_name" "text", "operator_id" "uuid", "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_offset INTEGER;
BEGIN
  -- Calcular offset para paginación
  v_offset := (p_page - 1) * p_limit;
  
  -- Validar límite
  IF p_limit > 100 THEN
    RAISE EXCEPTION 'Limit cannot exceed 100 records per page';
  END IF;
  
  RETURN QUERY
  WITH filtered_logs AS (
    SELECT
      psl.id,
      psl.scan_timestamp,
      psl.remote_shipment_id as tracking_code,
      psl.action_type,
      CASE psl.action_type
        WHEN 'delivery_confirmation' THEN 'Entrega confirmada'
        WHEN 'return_confirmation' THEN 'Devolución recibida'
        ELSE psl.action_type::TEXT
      END as action_type_label,
      psl.previous_status,
      psl.new_status,
      psl.previous_status || ' → ' || psl.new_status as status_transition,
      psl.api_request_successful as result,
      u.first_name || ' ' || u.last_name as operator_name,
      u.id as operator_id
    FROM public.pudo_scan_logs psl
    JOIN public.users u ON u.id = psl.scanned_by_user_id
    WHERE psl.pudo_location_id = p_location_id
      -- Filtro de fechas
      AND (p_date_from IS NULL OR psl.scan_timestamp >= p_date_from)
      AND (p_date_to IS NULL OR psl.scan_timestamp <= p_date_to)
      -- Filtro de tipo de acción
      AND (p_action_type IS NULL OR psl.action_type::TEXT = p_action_type)
      -- Filtro de resultado
      AND (
        p_result_filter IS NULL 
        OR (p_result_filter = 'success' AND psl.api_request_successful = true)
        OR (p_result_filter = 'failed' AND psl.api_request_successful = false)
      )
      -- Búsqueda por tracking
      AND (
        p_tracking_search IS NULL 
        OR psl.remote_shipment_id ILIKE '%' || p_tracking_search || '%'
      )
  ),
  total AS (
    SELECT COUNT(*) as count FROM filtered_logs
  )
  SELECT 
    fl.*,
    t.count as total_count
  FROM filtered_logs fl
  CROSS JOIN total t
  ORDER BY fl.scan_timestamp DESC
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;


ALTER FUNCTION "public"."get_pudo_operations_paginated"("p_location_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_action_type" "text", "p_result_filter" "text", "p_tracking_search" "text", "p_page" integer, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_pudo_operations_paginated"("p_location_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_action_type" "text", "p_result_filter" "text", "p_tracking_search" "text", "p_page" integer, "p_limit" integer) IS 'Obtiene el histórico de operaciones PUDO con filtros múltiples y paginación. Retorna total_count para implementar paginación en frontend.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.users (id, first_name, last_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')  -- default: 'user'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_package_event"("p_package_id" "uuid", "p_event_type" "public"."event_type_enum", "p_performed_by" "uuid" DEFAULT NULL::"uuid", "p_location_id" "uuid" DEFAULT NULL::"uuid", "p_old_status" "public"."package_status" DEFAULT NULL::"public"."package_status", "p_new_status" "public"."package_status" DEFAULT NULL::"public"."package_status", "p_qr_type" "text" DEFAULT NULL::"text", "p_error_code" "text" DEFAULT NULL::"text", "p_error_message" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.package_events (
    package_id,
    event_type,
    old_status,
    new_status,
    performed_by,
    location_id,
    qr_type,
    error_code,
    error_message,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    p_package_id,
    p_event_type,
    p_old_status,
    p_new_status,
    p_performed_by,
    p_location_id,
    p_qr_type,
    p_error_code,
    p_error_message,
    COALESCE(p_metadata, '{}'::jsonb),
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;


ALTER FUNCTION "public"."log_package_event"("p_package_id" "uuid", "p_event_type" "public"."event_type_enum", "p_performed_by" "uuid", "p_location_id" "uuid", "p_old_status" "public"."package_status", "p_new_status" "public"."package_status", "p_qr_type" "text", "p_error_code" "text", "p_error_message" "text", "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_package_event"("p_package_id" "uuid", "p_event_type" "public"."event_type_enum", "p_performed_by" "uuid", "p_location_id" "uuid", "p_old_status" "public"."package_status", "p_new_status" "public"."package_status", "p_qr_type" "text", "p_error_code" "text", "p_error_message" "text", "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") IS 'Registra un evento de auditoría para un paquete. Útil desde Edge Functions.';



CREATE OR REPLACE FUNCTION "public"."log_pudo_scan"("p_pudo_location_id" "uuid", "p_remote_shipment_id" "text", "p_previous_status" "text", "p_new_status" "text", "p_action_type" "text", "p_scan_latitude" numeric DEFAULT NULL::numeric, "p_scan_longitude" numeric DEFAULT NULL::numeric, "p_gps_accuracy_meters" numeric DEFAULT NULL::numeric, "p_device_info" "text" DEFAULT NULL::"text", "p_app_version" "text" DEFAULT NULL::"text", "p_api_successful" boolean DEFAULT false, "p_api_response_code" integer DEFAULT NULL::integer, "p_api_response_message" "text" DEFAULT NULL::"text", "p_api_duration_ms" integer DEFAULT NULL::integer, "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_log_id UUID;
  v_gps_valid BOOLEAN := false;
  v_user_id UUID;
BEGIN
  -- Obtener ID del usuario actual
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Validar acción
  IF p_action_type NOT IN ('delivery_confirmation', 'return_confirmation') THEN
    RAISE EXCEPTION 'Invalid action_type: %. Must be delivery_confirmation or return_confirmation', p_action_type;
  END IF;
  
  -- Validar GPS si se proporcionan coordenadas
  IF p_scan_latitude IS NOT NULL AND p_scan_longitude IS NOT NULL THEN
    v_gps_valid := public.validate_gps_location(
      p_scan_latitude,
      p_scan_longitude,
      p_pudo_location_id
    );
  END IF;
  
  -- Insertar log
  INSERT INTO public.pudo_scan_logs (
    pudo_location_id,
    remote_shipment_id,
    previous_status,
    new_status,
    scanned_by_user_id,
    action_type,
    scan_latitude,
    scan_longitude,
    gps_accuracy_meters,
    gps_validation_passed,
    device_info,
    app_version,
    api_request_successful,
    api_response_code,
    api_response_message,
    api_request_duration_ms,
    metadata
  ) VALUES (
    p_pudo_location_id,
    p_remote_shipment_id,
    p_previous_status,
    p_new_status,
    v_user_id,
    p_action_type::pudo_action_type,
    p_scan_latitude,
    p_scan_longitude,
    p_gps_accuracy_meters,
    v_gps_valid,
    p_device_info,
    p_app_version,
    p_api_successful,
    p_api_response_code,
    p_api_response_message,
    p_api_duration_ms,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_pudo_scan"("p_pudo_location_id" "uuid", "p_remote_shipment_id" "text", "p_previous_status" "text", "p_new_status" "text", "p_action_type" "text", "p_scan_latitude" numeric, "p_scan_longitude" numeric, "p_gps_accuracy_meters" numeric, "p_device_info" "text", "p_app_version" "text", "p_api_successful" boolean, "p_api_response_code" integer, "p_api_response_message" "text", "p_api_duration_ms" integer, "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_pudo_scan"("p_pudo_location_id" "uuid", "p_remote_shipment_id" "text", "p_previous_status" "text", "p_new_status" "text", "p_action_type" "text", "p_scan_latitude" numeric, "p_scan_longitude" numeric, "p_gps_accuracy_meters" numeric, "p_device_info" "text", "p_app_version" "text", "p_api_successful" boolean, "p_api_response_code" integer, "p_api_response_message" "text", "p_api_duration_ms" integer, "p_metadata" "jsonb") IS 'Registra un escaneo en punto PUDO con validación GPS automática y resultado de API remota';



CREATE OR REPLACE FUNCTION "public"."log_scan_error"("p_scanned_data" "text", "p_error_type" "text", "p_error_message" "text" DEFAULT NULL::"text", "p_location_id" "uuid" DEFAULT NULL::"uuid", "p_performed_by" "uuid" DEFAULT NULL::"uuid", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_error_id UUID;
BEGIN
  -- Validar tipo de error
  IF p_error_type NOT IN (
    'invalid_jwt', 'expired_qr', 'package_not_found',
    'wrong_state', 'permission_denied', 'invalid_signature',
    'unknown_error'
  ) THEN
    RAISE EXCEPTION 'Invalid error_type: %', p_error_type;
  END IF;
  
  INSERT INTO public.scan_errors (
    scanned_data,
    error_type,
    error_message,
    location_id,
    performed_by,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_scanned_data,
    p_error_type,
    p_error_message,
    p_location_id,
    p_performed_by,
    p_ip_address,
    p_user_agent,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_error_id;
  
  RETURN v_error_id;
END;
$$;


ALTER FUNCTION "public"."log_scan_error"("p_scanned_data" "text", "p_error_type" "text", "p_error_message" "text", "p_location_id" "uuid", "p_performed_by" "uuid", "p_ip_address" "inet", "p_user_agent" "text", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_scan_error"("p_scanned_data" "text", "p_error_type" "text", "p_error_message" "text", "p_location_id" "uuid", "p_performed_by" "uuid", "p_ip_address" "inet", "p_user_agent" "text", "p_metadata" "jsonb") IS 'Registra un error de escaneo. Útil desde Edge Functions.';



CREATE OR REPLACE FUNCTION "public"."my_location_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT location_id 
  FROM public.user_locations 
  WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."my_location_ids"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."my_location_ids"() IS 'Retorna los location_ids asignados al usuario autenticado actual.';



CREATE OR REPLACE FUNCTION "public"."my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;


ALTER FUNCTION "public"."my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_gps_location"("p_scan_lat" numeric, "p_scan_lon" numeric, "p_pudo_location_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_pudo_lat NUMERIC;
  v_pudo_lon NUMERIC;
  v_radius_meters INTEGER;
  v_distance_meters NUMERIC;
BEGIN
  -- Obtener coordenadas del punto PUDO
  SELECT latitude, longitude, gps_validation_radius_meters
  INTO v_pudo_lat, v_pudo_lon, v_radius_meters
  FROM public.locations
  WHERE id = p_pudo_location_id;
  
  -- Si no hay coordenadas configuradas, aprobar por defecto
  IF v_pudo_lat IS NULL OR v_pudo_lon IS NULL THEN
    RETURN true;
  END IF;
  
  -- Calcular distancia usando fórmula de Haversine (aproximación)
  -- Distancia en metros entre dos puntos GPS
  v_distance_meters := (
    6371000 * acos(
      cos(radians(v_pudo_lat)) * cos(radians(p_scan_lat)) *
      cos(radians(p_scan_lon) - radians(v_pudo_lon)) +
      sin(radians(v_pudo_lat)) * sin(radians(p_scan_lat))
    )
  );
  
  -- Validar si está dentro del radio
  RETURN v_distance_meters <= v_radius_meters;
END;
$$;


ALTER FUNCTION "public"."validate_gps_location"("p_scan_lat" numeric, "p_scan_lon" numeric, "p_pudo_location_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_gps_location"("p_scan_lat" numeric, "p_scan_lon" numeric, "p_pudo_location_id" "uuid") IS 'Valida si las coordenadas GPS del escaneo están dentro del radio permitido del punto PUDO usando fórmula de Haversine';



CREATE OR REPLACE FUNCTION "public"."validate_package_state_transition"("p_current_status" "public"."package_status", "p_new_status" "public"."package_status", "p_type" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Validar transiciones para delivery
  IF p_type = 'delivery' THEN
    CASE p_current_status
      WHEN 'pending_dropoff' THEN
        RETURN p_new_status IN ('in_location', 'returned');
      WHEN 'in_location' THEN
        RETURN p_new_status IN ('picked_up', 'returned');
      WHEN 'picked_up' THEN
        RETURN FALSE; -- Estado final
      ELSE
        RETURN FALSE;
    END CASE;
  END IF;

  -- Validar transiciones para return
  IF p_type = 'return' THEN
    CASE p_current_status
      WHEN 'pending_dropoff' THEN
        RETURN p_new_status IN ('in_location', 'returned');
      WHEN 'in_location' THEN
        RETURN p_new_status IN ('returned');
      WHEN 'returned' THEN
        RETURN FALSE; -- Estado final
      ELSE
        RETURN FALSE;
    END CASE;
  END IF;

  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."validate_package_state_transition"("p_current_status" "public"."package_status", "p_new_status" "public"."package_status", "p_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_package_state_transition"("p_current_status" "public"."package_status", "p_new_status" "public"."package_status", "p_type" "text") IS 'Valida que la transición de estado sea válida según el tipo de package (delivery/return)';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text" NOT NULL,
    "commission_rate" numeric(10,2) DEFAULT 0.35 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "postal_code" "text",
    "city" "text",
    "location_name" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "gps_validation_radius_meters" integer DEFAULT 50,
    "pudo_id" "text" NOT NULL,
    CONSTRAINT "locations_commission_rate_check" CHECK (("commission_rate" >= (0)::numeric))
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."locations" IS 'Puntos de conveniencia (locales comerciales).';



COMMENT ON COLUMN "public"."locations"."commission_rate" IS 'Comisión por paquete en EUR.';



COMMENT ON COLUMN "public"."locations"."latitude" IS 'Latitud del punto PUDO para validación GPS';



COMMENT ON COLUMN "public"."locations"."longitude" IS 'Longitud del punto PUDO para validación GPS';



COMMENT ON COLUMN "public"."locations"."gps_validation_radius_meters" IS 'Radio en metros dentro del cual se considera válido el escaneo (por defecto 50m)';



COMMENT ON COLUMN "public"."locations"."pudo_id" IS 'Identificador único del punto PUDO en formato brickshare-XXX (secuencial de 3 dígitos)';



CREATE TABLE IF NOT EXISTS "public"."package_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "event_type" "public"."event_type_enum" NOT NULL,
    "old_status" "public"."package_status",
    "new_status" "public"."package_status",
    "performed_by" "uuid",
    "location_id" "uuid",
    "qr_type" "text",
    "error_code" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "device_info" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "package_events_qr_type_check" CHECK (("qr_type" = ANY (ARRAY['dynamic'::"text", 'static'::"text"])))
);


ALTER TABLE "public"."package_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."package_events" IS 'Auditoría completa de eventos en paquetes: generación de QR, escaneos, cambios de estado, errores';



COMMENT ON COLUMN "public"."package_events"."package_id" IS 'UUID del paquete asociado';



COMMENT ON COLUMN "public"."package_events"."event_type" IS 'Tipo de evento: generación QR, escaneo exitoso, escaneo fallido, etc.';



COMMENT ON COLUMN "public"."package_events"."performed_by" IS 'UUID del usuario que realizó la acción (owner, admin, o NULL si es sistema)';



COMMENT ON COLUMN "public"."package_events"."qr_type" IS 'Tipo de QR: dynamic (expira) o static (permanente hasta escaneo)';



COMMENT ON COLUMN "public"."package_events"."metadata" IS 'Datos flexibles en JSON: source, reason, retry_count, etc.';



CREATE OR REPLACE VIEW "public"."audit_summary" AS
 SELECT "date"("pe"."created_at") AS "audit_date",
    "pe"."location_id",
    "l"."name" AS "location_name",
    "count"(DISTINCT "pe"."package_id") AS "packages_processed",
    "count"("pe".*) FILTER (WHERE ("pe"."event_type" = 'qr_generated'::"public"."event_type_enum")) AS "qr_generated",
    "count"("pe".*) FILTER (WHERE ("pe"."event_type" = 'qr_scanned_success'::"public"."event_type_enum")) AS "qr_scanned_success",
    "count"("pe".*) FILTER (WHERE ("pe"."event_type" = 'status_changed'::"public"."event_type_enum")) AS "status_changes",
    "count"("pe".*) FILTER (WHERE ("pe"."event_type" = ANY (ARRAY['qr_scanned_failed'::"public"."event_type_enum", 'manual_adjustment'::"public"."event_type_enum"]))) AS "issues",
    "count"(DISTINCT "pe"."performed_by") AS "unique_operators"
   FROM ("public"."package_events" "pe"
     LEFT JOIN "public"."locations" "l" ON (("l"."id" = "pe"."location_id")))
  GROUP BY ("date"("pe"."created_at")), "pe"."location_id", "l"."name";


ALTER VIEW "public"."audit_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."audit_summary" IS 'Resumen diario de auditoría por location. Útil para dashboards de operaciones.';



CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tracking_code" "text" NOT NULL,
    "status" "public"."package_status" DEFAULT 'pending_dropoff'::"public"."package_status" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "dynamic_qr_hash" "text",
    "qr_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" DEFAULT 'delivery'::"text" NOT NULL,
    "static_qr_hash" "text",
    "external_shipment_id" "text",
    "source_system" "text" DEFAULT 'logistics'::"text" NOT NULL,
    "remote_customer_name" "text",
    "remote_delivery_address" "text",
    "remote_shipping_status" "text",
    "remote_estimated_delivery" timestamp with time zone,
    "remote_shipment_data" "jsonb" DEFAULT '{}'::"jsonb",
    "received_at" timestamp with time zone,
    CONSTRAINT "packages_source_system_check" CHECK (("source_system" = ANY (ARRAY['logistics'::"text", 'brickshare'::"text"]))),
    CONSTRAINT "packages_type_check" CHECK (("type" = ANY (ARRAY['delivery'::"text", 'return'::"text"])))
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


COMMENT ON TABLE "public"."packages" IS 'Paquetes en tránsito a través de los puntos de conveniencia.';



COMMENT ON COLUMN "public"."packages"."dynamic_qr_hash" IS 'Hash/JWT para entrega. Generado por generate-dynamic-qr.';



COMMENT ON COLUMN "public"."packages"."qr_expires_at" IS 'Expiración del QR. Válido 5 minutos desde generación.';



COMMENT ON COLUMN "public"."packages"."type" IS 'Tipo de paquete: delivery (oficinas→cliente) o return (cliente→oficinas)';



COMMENT ON COLUMN "public"."packages"."static_qr_hash" IS 'JWT/hash estático para devoluciones. No expira temporalmente, válido hasta que se escanee.';



COMMENT ON COLUMN "public"."packages"."external_shipment_id" IS 'ID del shipment en el sistema externo (ej: Brickshare). Usado para sincronización.';



COMMENT ON COLUMN "public"."packages"."source_system" IS 'Sistema que creó el package: logistics (creado localmente) o brickshare (creado desde integración).';



COMMENT ON COLUMN "public"."packages"."remote_customer_name" IS 'Nombre del destinatario obtenido del sistema remoto Brickshare';



COMMENT ON COLUMN "public"."packages"."remote_delivery_address" IS 'Dirección de entrega original del envío remoto';



COMMENT ON COLUMN "public"."packages"."remote_shipping_status" IS 'Estado del shipping en sistema remoto al momento del escaneo';



COMMENT ON COLUMN "public"."packages"."remote_shipment_data" IS 'Datos completos del shipment remoto en formato JSON';



COMMENT ON COLUMN "public"."packages"."received_at" IS 'Timestamp de cuando el paquete fue recepcionado (escaneado) en el PUDO';



CREATE OR REPLACE VIEW "public"."external_packages" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."tracking_code",
    "p"."status",
    "p"."type",
    "p"."location_id",
    "l"."name" AS "location_name",
    "l"."address" AS "location_address",
    "p"."customer_id",
    "p"."dynamic_qr_hash",
    "p"."static_qr_hash",
    "p"."qr_expires_at",
    "p"."external_shipment_id",
    "p"."source_system",
    "p"."created_at",
    "p"."updated_at"
   FROM ("public"."packages" "p"
     JOIN "public"."locations" "l" ON (("l"."id" = "p"."location_id")))
  WHERE ("p"."source_system" <> 'logistics'::"text");


ALTER VIEW "public"."external_packages" OWNER TO "postgres";


COMMENT ON VIEW "public"."external_packages" IS 'Vista de packages creados desde sistemas externos. Respeta RLS.';



CREATE SEQUENCE IF NOT EXISTS "public"."locations_pudo_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."locations_pudo_seq" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."monthly_profitability" WITH ("security_invoker"='true') AS
 SELECT "to_char"("p"."created_at", 'YYYY-MM'::"text") AS "month",
    "l"."id" AS "location_id",
    "l"."name" AS "location_name",
    "l"."commission_rate",
    "count"(*) AS "total_packages",
    "count"(*) FILTER (WHERE ("p"."status" = ANY (ARRAY['pending_dropoff'::"public"."package_status", 'in_location'::"public"."package_status"]))) AS "active_packages",
    "count"(*) FILTER (WHERE ("p"."status" = 'in_location'::"public"."package_status")) AS "dropoffs",
    "count"(*) FILTER (WHERE ("p"."status" = 'picked_up'::"public"."package_status")) AS "pickups",
    "sum"("l"."commission_rate") FILTER (WHERE ("p"."status" = 'picked_up'::"public"."package_status")) AS "profitability"
   FROM ("public"."packages" "p"
     JOIN "public"."locations" "l" ON (("l"."id" = "p"."location_id")))
  GROUP BY ("to_char"("p"."created_at", 'YYYY-MM'::"text")), "l"."id", "l"."name", "l"."commission_rate"
  ORDER BY ("to_char"("p"."created_at", 'YYYY-MM'::"text")) DESC, "l"."name";


ALTER VIEW "public"."monthly_profitability" OWNER TO "postgres";


COMMENT ON VIEW "public"."monthly_profitability" IS 'Pre-calcula entregas, recogidas y rentabilidad mensual por local. Respeta RLS (users ven solo sus locations asignados).';



CREATE TABLE IF NOT EXISTS "public"."pudo_scan_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pudo_location_id" "uuid" NOT NULL,
    "remote_shipment_id" "text" NOT NULL,
    "previous_status" "text" NOT NULL,
    "new_status" "text" NOT NULL,
    "scanned_by_user_id" "uuid" NOT NULL,
    "action_type" "public"."pudo_action_type" NOT NULL,
    "scan_timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scan_latitude" numeric(10,8),
    "scan_longitude" numeric(11,8),
    "gps_accuracy_meters" numeric(8,2),
    "gps_validation_passed" boolean DEFAULT false,
    "device_info" "text",
    "app_version" "text",
    "api_request_successful" boolean DEFAULT false NOT NULL,
    "api_response_code" integer,
    "api_response_message" "text",
    "api_request_duration_ms" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pudo_scan_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."pudo_scan_logs" IS 'Registro de todas las acciones de escaneo QR en centros PUDO con validación GPS y resultado de API remota';



COMMENT ON COLUMN "public"."pudo_scan_logs"."remote_shipment_id" IS 'ID del shipment en la base de datos remota de Brickshare';



COMMENT ON COLUMN "public"."pudo_scan_logs"."gps_validation_passed" IS 'Indica si las coordenadas GPS del escaneo están dentro del radio permitido del punto PUDO';



COMMENT ON COLUMN "public"."pudo_scan_logs"."api_request_successful" IS 'Indica si la solicitud de cambio de estado a la API remota fue exitosa';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'usuarios'::"text" NOT NULL,
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text",
    "phone" "text" DEFAULT '+34 '::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Perfiles de usuario. Extiende auth.users.';



COMMENT ON COLUMN "public"."users"."role" IS 'admin | owner | customer';



CREATE OR REPLACE VIEW "public"."pudo_active_packages_enhanced" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."tracking_code",
    "p"."status",
    "p"."location_id",
    "p"."customer_id",
    "p"."created_at",
    "p"."updated_at",
    (EXTRACT(epoch FROM ("now"() - "p"."updated_at")) / (3600)::numeric) AS "hours_in_location",
    COALESCE((("u"."first_name" || ' '::"text") || "u"."last_name"), 'Desconocido'::"text") AS "customer_name",
    COALESCE("u"."first_name", ''::"text") AS "customer_first_name",
    COALESCE("u"."last_name", ''::"text") AS "customer_last_name",
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM "public"."pudo_scan_logs" "psl"
              WHERE (("psl"."remote_shipment_id" = "p"."tracking_code") AND ("psl"."action_type" = 'return_confirmation'::"public"."pudo_action_type")))) THEN 'return'::"text"
            ELSE 'delivery'::"text"
        END AS "package_type",
    "row_number"() OVER (PARTITION BY "p"."location_id" ORDER BY "p"."created_at") AS "package_number"
   FROM ("public"."packages" "p"
     LEFT JOIN "public"."users" "u" ON (("u"."id" = "p"."customer_id")))
  WHERE ("p"."status" = 'in_location'::"public"."package_status");


ALTER VIEW "public"."pudo_active_packages_enhanced" OWNER TO "postgres";


COMMENT ON VIEW "public"."pudo_active_packages_enhanced" IS 'Vista mejorada de paquetes activos en local con tipo, tiempo y datos del cliente. Respeta RLS.';



CREATE OR REPLACE VIEW "public"."pudo_operations_history" WITH ("security_invoker"='true') AS
 SELECT "psl"."id",
    "psl"."scan_timestamp",
    "psl"."remote_shipment_id" AS "tracking_code",
    "psl"."action_type",
    "psl"."previous_status",
    "psl"."new_status",
    "psl"."api_request_successful" AS "result",
    "psl"."pudo_location_id",
    (("u"."first_name" || ' '::"text") || "u"."last_name") AS "operator_name",
    "u"."first_name" AS "operator_first_name",
    "u"."last_name" AS "operator_last_name",
    "u"."id" AS "operator_id",
    "l"."name" AS "location_name",
        CASE "psl"."action_type"
            WHEN 'delivery_confirmation'::"public"."pudo_action_type" THEN 'Entrega confirmada'::"text"
            WHEN 'return_confirmation'::"public"."pudo_action_type" THEN 'Devolución recibida'::"text"
            ELSE ("psl"."action_type")::"text"
        END AS "action_type_label",
    (("psl"."previous_status" || ' → '::"text") || "psl"."new_status") AS "status_transition"
   FROM (("public"."pudo_scan_logs" "psl"
     JOIN "public"."users" "u" ON (("u"."id" = "psl"."scanned_by_user_id")))
     JOIN "public"."locations" "l" ON (("l"."id" = "psl"."pudo_location_id")))
  ORDER BY "psl"."scan_timestamp" DESC;


ALTER VIEW "public"."pudo_operations_history" OWNER TO "postgres";


COMMENT ON VIEW "public"."pudo_operations_history" IS 'Historial simplificado de operaciones PUDO con operador y resultado. Respeta RLS (users ven solo sus locations).';



CREATE OR REPLACE VIEW "public"."pudo_scan_summary" AS
 SELECT "l"."id" AS "location_id",
    "l"."name" AS "location_name",
    "date"("psl"."scan_timestamp") AS "scan_date",
    "psl"."action_type",
    "count"(*) AS "total_scans",
    "count"(*) FILTER (WHERE ("psl"."api_request_successful" = true)) AS "successful_scans",
    "count"(*) FILTER (WHERE ("psl"."api_request_successful" = false)) AS "failed_scans",
    "count"(*) FILTER (WHERE ("psl"."gps_validation_passed" = true)) AS "gps_valid_scans",
    "count"(*) FILTER (WHERE ("psl"."gps_validation_passed" = false)) AS "gps_invalid_scans",
    ("avg"("psl"."api_request_duration_ms"))::integer AS "avg_api_duration_ms",
    "count"(DISTINCT "psl"."scanned_by_user_id") AS "unique_operators"
   FROM ("public"."pudo_scan_logs" "psl"
     JOIN "public"."locations" "l" ON (("l"."id" = "psl"."pudo_location_id")))
  GROUP BY "l"."id", "l"."name", ("date"("psl"."scan_timestamp")), "psl"."action_type";


ALTER VIEW "public"."pudo_scan_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."pudo_scan_summary" IS 'Resumen diario de escaneos por punto PUDO, tipo de acción y resultado';



CREATE TABLE IF NOT EXISTS "public"."scan_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scanned_data" "text" NOT NULL,
    "error_type" "text" NOT NULL,
    "error_message" "text",
    "location_id" "uuid",
    "performed_by" "uuid",
    "ip_address" "inet",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scan_errors_error_type_check" CHECK (("error_type" = ANY (ARRAY['invalid_jwt'::"text", 'expired_qr'::"text", 'package_not_found'::"text", 'wrong_state'::"text", 'permission_denied'::"text", 'invalid_signature'::"text", 'unknown_error'::"text"])))
);


ALTER TABLE "public"."scan_errors" OWNER TO "postgres";


COMMENT ON TABLE "public"."scan_errors" IS 'Registro de intentos fallidos de escaneo QR/códigos de barras. Útil para debugging, detección de fraude y análisis de patrones';



COMMENT ON COLUMN "public"."scan_errors"."scanned_data" IS 'Primeros caracteres del dato escaneado (sin guardar todo por privacidad)';



COMMENT ON COLUMN "public"."scan_errors"."error_type" IS 'Clasificación del error para análisis estadístico';



COMMENT ON COLUMN "public"."scan_errors"."metadata" IS 'Datos contextuales: retry_count, package_status_found, etc.';



CREATE TABLE IF NOT EXISTS "public"."user_locations" (
    "user_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_locations" IS 'Relación many-to-many: usuarios pueden trabajar en múltiples locations y viceversa.';



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_events"
    ADD CONSTRAINT "package_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_tracking_code_key" UNIQUE ("tracking_code");



ALTER TABLE ONLY "public"."pudo_scan_logs"
    ADD CONSTRAINT "pudo_scan_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scan_errors"
    ADD CONSTRAINT "scan_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "unique_pudo_id" UNIQUE ("pudo_id");



ALTER TABLE ONLY "public"."user_locations"
    ADD CONSTRAINT "user_locations_pkey" PRIMARY KEY ("user_id", "location_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_locations_pudo_id" ON "public"."locations" USING "btree" ("pudo_id");



CREATE INDEX "idx_package_events_event_type" ON "public"."package_events" USING "btree" ("event_type");



CREATE INDEX "idx_package_events_location_id" ON "public"."package_events" USING "btree" ("location_id");



CREATE INDEX "idx_package_events_location_timestamp" ON "public"."package_events" USING "btree" ("location_id", "created_at" DESC);



CREATE INDEX "idx_package_events_package_id" ON "public"."package_events" USING "btree" ("package_id");



CREATE INDEX "idx_package_events_performed_by" ON "public"."package_events" USING "btree" ("performed_by");



CREATE INDEX "idx_package_events_timestamp" ON "public"."package_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_packages_customer_id" ON "public"."packages" USING "btree" ("customer_id");



CREATE INDEX "idx_packages_external_shipment_id" ON "public"."packages" USING "btree" ("external_shipment_id");



CREATE INDEX "idx_packages_location_id" ON "public"."packages" USING "btree" ("location_id");



CREATE INDEX "idx_packages_location_status" ON "public"."packages" USING "btree" ("location_id", "status") WHERE ("status" = 'in_location'::"public"."package_status");



CREATE INDEX "idx_packages_source_external" ON "public"."packages" USING "btree" ("source_system", "external_shipment_id");



CREATE INDEX "idx_packages_source_system" ON "public"."packages" USING "btree" ("source_system");



CREATE INDEX "idx_packages_status" ON "public"."packages" USING "btree" ("status");



CREATE INDEX "idx_packages_tracking" ON "public"."packages" USING "btree" ("tracking_code");



CREATE INDEX "idx_packages_type" ON "public"."packages" USING "btree" ("type");



CREATE INDEX "idx_pudo_scan_logs_action_type" ON "public"."pudo_scan_logs" USING "btree" ("action_type");



CREATE INDEX "idx_pudo_scan_logs_location" ON "public"."pudo_scan_logs" USING "btree" ("pudo_location_id");



CREATE INDEX "idx_pudo_scan_logs_location_date" ON "public"."pudo_scan_logs" USING "btree" ("pudo_location_id", "scan_timestamp" DESC);



CREATE INDEX "idx_pudo_scan_logs_location_timestamp_action" ON "public"."pudo_scan_logs" USING "btree" ("pudo_location_id", "scan_timestamp" DESC, "action_type");



CREATE INDEX "idx_pudo_scan_logs_shipment" ON "public"."pudo_scan_logs" USING "btree" ("remote_shipment_id");



CREATE INDEX "idx_pudo_scan_logs_shipment_gin" ON "public"."pudo_scan_logs" USING "gin" ("remote_shipment_id" "public"."gin_trgm_ops");



CREATE INDEX "idx_pudo_scan_logs_timestamp" ON "public"."pudo_scan_logs" USING "btree" ("scan_timestamp" DESC);



CREATE INDEX "idx_pudo_scan_logs_user" ON "public"."pudo_scan_logs" USING "btree" ("scanned_by_user_id");



CREATE INDEX "idx_scan_errors_error_type" ON "public"."scan_errors" USING "btree" ("error_type");



CREATE INDEX "idx_scan_errors_ip_timestamp" ON "public"."scan_errors" USING "btree" ("ip_address", "created_at" DESC);



CREATE INDEX "idx_scan_errors_location" ON "public"."scan_errors" USING "btree" ("location_id");



CREATE INDEX "idx_scan_errors_location_timestamp" ON "public"."scan_errors" USING "btree" ("location_id", "created_at" DESC);



CREATE INDEX "idx_scan_errors_performed_by" ON "public"."scan_errors" USING "btree" ("performed_by");



CREATE INDEX "idx_scan_errors_timestamp" ON "public"."scan_errors" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_locations_location_id" ON "public"."user_locations" USING "btree" ("location_id");



CREATE INDEX "idx_user_locations_user_id" ON "public"."user_locations" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "packages_updated_at" BEFORE UPDATE ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "packages_validate_state_transition" BEFORE UPDATE OF "status" ON "public"."packages" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."check_package_state_transition"();



COMMENT ON TRIGGER "packages_validate_state_transition" ON "public"."packages" IS 'Valida que las transiciones de estado sean correctas según el tipo de package';



CREATE OR REPLACE TRIGGER "set_pudo_id_on_insert" BEFORE INSERT ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."generate_pudo_id"();



ALTER TABLE ONLY "public"."package_events"
    ADD CONSTRAINT "package_events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_events"
    ADD CONSTRAINT "package_events_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."package_events"
    ADD CONSTRAINT "package_events_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pudo_scan_logs"
    ADD CONSTRAINT "pudo_scan_logs_pudo_location_id_fkey" FOREIGN KEY ("pudo_location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pudo_scan_logs"
    ADD CONSTRAINT "pudo_scan_logs_scanned_by_user_id_fkey" FOREIGN KEY ("scanned_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scan_errors"
    ADD CONSTRAINT "scan_errors_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scan_errors"
    ADD CONSTRAINT "scan_errors_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_locations"
    ADD CONSTRAINT "user_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_locations"
    ADD CONSTRAINT "user_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locations_admin_delete" ON "public"."locations" FOR DELETE USING (("public"."my_role"() = 'admin'::"text"));



CREATE POLICY "locations_admin_insert" ON "public"."locations" FOR INSERT WITH CHECK (("public"."my_role"() = 'admin'::"text"));



CREATE POLICY "locations_admin_update" ON "public"."locations" FOR UPDATE USING (("public"."my_role"() = 'admin'::"text")) WITH CHECK (("public"."my_role"() = 'admin'::"text"));



CREATE POLICY "locations_public_select" ON "public"."locations" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "locations_user_select" ON "public"."locations" FOR SELECT USING ((("id" IN ( SELECT "public"."my_location_ids"() AS "my_location_ids")) OR ("public"."my_role"() = 'admin'::"text")));



ALTER TABLE "public"."package_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "package_events_admin_all" ON "public"."package_events" FOR SELECT TO "authenticated" USING (("public"."my_role"() = 'admin'::"text"));



ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "packages_admin_all" ON "public"."packages" USING (("public"."my_role"() = 'admin'::"text"));



CREATE POLICY "packages_service_role_insert" ON "public"."packages" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "packages_user_insert" ON "public"."packages" FOR INSERT WITH CHECK ((("location_id" IN ( SELECT "public"."my_location_ids"() AS "my_location_ids")) OR ("public"."my_role"() = 'admin'::"text")));



CREATE POLICY "packages_user_select" ON "public"."packages" FOR SELECT USING ((("location_id" IN ( SELECT "public"."my_location_ids"() AS "my_location_ids")) OR ("public"."my_role"() = 'admin'::"text")));



CREATE POLICY "packages_user_update" ON "public"."packages" FOR UPDATE USING ((("location_id" IN ( SELECT "public"."my_location_ids"() AS "my_location_ids")) OR ("public"."my_role"() = 'admin'::"text"))) WITH CHECK ((("location_id" IN ( SELECT "public"."my_location_ids"() AS "my_location_ids")) OR ("public"."my_role"() = 'admin'::"text")));



ALTER TABLE "public"."pudo_scan_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pudo_scan_logs_admin_all" ON "public"."pudo_scan_logs" FOR SELECT TO "authenticated" USING (("public"."my_role"() = 'admin'::"text"));



ALTER TABLE "public"."scan_errors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scan_errors_admin_all" ON "public"."scan_errors" FOR SELECT TO "authenticated" USING (("public"."my_role"() = 'admin'::"text"));



ALTER TABLE "public"."user_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_locations_admin_all" ON "public"."user_locations" USING (("public"."my_role"() = 'admin'::"text")) WITH CHECK (("public"."my_role"() = 'admin'::"text"));



CREATE POLICY "user_locations_self_select" ON "public"."user_locations" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("public"."my_role"() = 'admin'::"text")));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_admin_all" ON "public"."users" USING (("public"."my_role"() = 'admin'::"text"));



CREATE POLICY "users_insert_own" ON "public"."users" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "users_select_own" ON "public"."users" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("public"."my_role"() = 'admin'::"text")));



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."check_package_state_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_package_state_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_package_state_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"("p_days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"("p_days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"("p_days_to_keep" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_external_package"("p_tracking_code" "text", "p_type" "text", "p_location_id" "uuid", "p_customer_id" "uuid", "p_external_shipment_id" "text", "p_source_system" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_external_package"("p_tracking_code" "text", "p_type" "text", "p_location_id" "uuid", "p_customer_id" "uuid", "p_external_shipment_id" "text", "p_source_system" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_external_package"("p_tracking_code" "text", "p_type" "text", "p_location_id" "uuid", "p_customer_id" "uuid", "p_external_shipment_id" "text", "p_source_system" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_scan_attack"("p_location_id" "uuid", "p_error_threshold" integer, "p_time_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."detect_scan_attack"("p_location_id" "uuid", "p_error_threshold" integer, "p_time_window_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_scan_attack"("p_location_id" "uuid", "p_error_threshold" integer, "p_time_window_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."export_pudo_operations_csv"("p_location_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_action_type" "text", "p_result_filter" "text", "p_tracking_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_pudo_operations_csv"("p_location_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_action_type" "text", "p_result_filter" "text", "p_tracking_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_pudo_operations_csv"("p_location_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_action_type" "text", "p_result_filter" "text", "p_tracking_search" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_pudo_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_pudo_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_pudo_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pudo_operations_paginated"("p_location_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_action_type" "text", "p_result_filter" "text", "p_tracking_search" "text", "p_page" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pudo_operations_paginated"("p_location_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_action_type" "text", "p_result_filter" "text", "p_tracking_search" "text", "p_page" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pudo_operations_paginated"("p_location_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_action_type" "text", "p_result_filter" "text", "p_tracking_search" "text", "p_page" integer, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_package_event"("p_package_id" "uuid", "p_event_type" "public"."event_type_enum", "p_performed_by" "uuid", "p_location_id" "uuid", "p_old_status" "public"."package_status", "p_new_status" "public"."package_status", "p_qr_type" "text", "p_error_code" "text", "p_error_message" "text", "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_package_event"("p_package_id" "uuid", "p_event_type" "public"."event_type_enum", "p_performed_by" "uuid", "p_location_id" "uuid", "p_old_status" "public"."package_status", "p_new_status" "public"."package_status", "p_qr_type" "text", "p_error_code" "text", "p_error_message" "text", "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_package_event"("p_package_id" "uuid", "p_event_type" "public"."event_type_enum", "p_performed_by" "uuid", "p_location_id" "uuid", "p_old_status" "public"."package_status", "p_new_status" "public"."package_status", "p_qr_type" "text", "p_error_code" "text", "p_error_message" "text", "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_pudo_scan"("p_pudo_location_id" "uuid", "p_remote_shipment_id" "text", "p_previous_status" "text", "p_new_status" "text", "p_action_type" "text", "p_scan_latitude" numeric, "p_scan_longitude" numeric, "p_gps_accuracy_meters" numeric, "p_device_info" "text", "p_app_version" "text", "p_api_successful" boolean, "p_api_response_code" integer, "p_api_response_message" "text", "p_api_duration_ms" integer, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_pudo_scan"("p_pudo_location_id" "uuid", "p_remote_shipment_id" "text", "p_previous_status" "text", "p_new_status" "text", "p_action_type" "text", "p_scan_latitude" numeric, "p_scan_longitude" numeric, "p_gps_accuracy_meters" numeric, "p_device_info" "text", "p_app_version" "text", "p_api_successful" boolean, "p_api_response_code" integer, "p_api_response_message" "text", "p_api_duration_ms" integer, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_pudo_scan"("p_pudo_location_id" "uuid", "p_remote_shipment_id" "text", "p_previous_status" "text", "p_new_status" "text", "p_action_type" "text", "p_scan_latitude" numeric, "p_scan_longitude" numeric, "p_gps_accuracy_meters" numeric, "p_device_info" "text", "p_app_version" "text", "p_api_successful" boolean, "p_api_response_code" integer, "p_api_response_message" "text", "p_api_duration_ms" integer, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_scan_error"("p_scanned_data" "text", "p_error_type" "text", "p_error_message" "text", "p_location_id" "uuid", "p_performed_by" "uuid", "p_ip_address" "inet", "p_user_agent" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_scan_error"("p_scanned_data" "text", "p_error_type" "text", "p_error_message" "text", "p_location_id" "uuid", "p_performed_by" "uuid", "p_ip_address" "inet", "p_user_agent" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_scan_error"("p_scanned_data" "text", "p_error_type" "text", "p_error_message" "text", "p_location_id" "uuid", "p_performed_by" "uuid", "p_ip_address" "inet", "p_user_agent" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."my_location_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_location_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_location_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_gps_location"("p_scan_lat" numeric, "p_scan_lon" numeric, "p_pudo_location_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_gps_location"("p_scan_lat" numeric, "p_scan_lon" numeric, "p_pudo_location_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_gps_location"("p_scan_lat" numeric, "p_scan_lon" numeric, "p_pudo_location_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_package_state_transition"("p_current_status" "public"."package_status", "p_new_status" "public"."package_status", "p_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_package_state_transition"("p_current_status" "public"."package_status", "p_new_status" "public"."package_status", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_package_state_transition"("p_current_status" "public"."package_status", "p_new_status" "public"."package_status", "p_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."package_events" TO "anon";
GRANT ALL ON TABLE "public"."package_events" TO "authenticated";
GRANT ALL ON TABLE "public"."package_events" TO "service_role";



GRANT ALL ON TABLE "public"."audit_summary" TO "anon";
GRANT ALL ON TABLE "public"."audit_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_summary" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."external_packages" TO "anon";
GRANT ALL ON TABLE "public"."external_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."external_packages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."locations_pudo_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."locations_pudo_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."locations_pudo_seq" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_profitability" TO "anon";
GRANT ALL ON TABLE "public"."monthly_profitability" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_profitability" TO "service_role";



GRANT ALL ON TABLE "public"."pudo_scan_logs" TO "anon";
GRANT ALL ON TABLE "public"."pudo_scan_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."pudo_scan_logs" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."pudo_active_packages_enhanced" TO "anon";
GRANT ALL ON TABLE "public"."pudo_active_packages_enhanced" TO "authenticated";
GRANT ALL ON TABLE "public"."pudo_active_packages_enhanced" TO "service_role";



GRANT ALL ON TABLE "public"."pudo_operations_history" TO "anon";
GRANT ALL ON TABLE "public"."pudo_operations_history" TO "authenticated";
GRANT ALL ON TABLE "public"."pudo_operations_history" TO "service_role";



GRANT ALL ON TABLE "public"."pudo_scan_summary" TO "anon";
GRANT ALL ON TABLE "public"."pudo_scan_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."pudo_scan_summary" TO "service_role";



GRANT ALL ON TABLE "public"."scan_errors" TO "anon";
GRANT ALL ON TABLE "public"."scan_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."scan_errors" TO "service_role";



GRANT ALL ON TABLE "public"."user_locations" TO "anon";
GRANT ALL ON TABLE "public"."user_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_locations" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































