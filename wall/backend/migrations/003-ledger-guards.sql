CREATE TRIGGER matching_asset_upload BEFORE INSERT ON assets BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM uploads u WHERE u.id=NEW.id AND u.tenant_id=NEW.tenant_id AND u.site_id=NEW.site_id AND u.object_key=NEW.object_key AND u.hash=NEW.hash AND u.bytes=NEW.bytes AND u.mime=NEW.mime AND u.state='staged') THEN RAISE(ABORT,'Asset must match its staged upload') END;
END;
CREATE TRIGGER empty_initial_head BEFORE INSERT ON publication_heads WHEN NEW.generation<>0 OR NEW.release_id IS NOT NULL OR NEW.job_id IS NOT NULL OR NEW.domain_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'Initial publication head must be empty'); END;
CREATE TRIGGER retained_jobs_delete BEFORE DELETE ON publication_jobs BEGIN SELECT RAISE(ABORT,'Publication jobs are retained for recovery'); END;
