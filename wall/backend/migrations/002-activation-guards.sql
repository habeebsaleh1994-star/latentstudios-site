CREATE TRIGGER valid_head_update BEFORE UPDATE ON publication_heads WHEN NEW.job_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM publication_jobs j WHERE j.id=NEW.job_id AND j.tenant_id=NEW.tenant_id AND j.site_id=NEW.site_id AND j.release_id=NEW.release_id AND j.domain_id=NEW.domain_id AND j.state='committed' AND j.artifact IS NOT NULL) THEN RAISE(ABORT,'Publication head requires a matching committed job') END;
END;
CREATE TRIGGER sealed_job_update BEFORE UPDATE ON publication_jobs WHEN OLD.state IN ('committed','failed') BEGIN SELECT RAISE(ABORT,'Publication outcome is sealed'); END;
CREATE TRIGGER immutable_events_update BEFORE UPDATE ON publication_events BEGIN SELECT RAISE(ABORT,'Immutable publication event'); END;
CREATE TRIGGER immutable_events_delete BEFORE DELETE ON publication_events BEGIN SELECT RAISE(ABORT,'Immutable publication event'); END;
