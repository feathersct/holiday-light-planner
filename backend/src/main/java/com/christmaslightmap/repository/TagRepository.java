package com.christmaslightmap.repository;

import com.christmaslightmap.model.Tag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TagRepository extends JpaRepository<Tag, Long> {
    List<Tag> findAllByOrderByNameAsc();
}
