package com.christmaslightmap.repository;

import com.christmaslightmap.model.Display;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DisplayRepository extends JpaRepository<Display, Long> {
    List<Display> findByUserIdAndIsActiveTrue(Long userId);
}
