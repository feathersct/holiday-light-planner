package com.christmaslightmap.repository;

import com.christmaslightmap.model.Tag;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TagRepository extends JpaRepository<Tag, Long> {
}
