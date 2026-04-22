package com.christmaslightmap.repository;

import com.christmaslightmap.model.DisplayPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DisplayPhotoRepository extends JpaRepository<DisplayPhoto, Long> {
    List<DisplayPhoto> findByDisplay_Id(Long displayId);

    @Query("SELECT p FROM DisplayPhoto p WHERE p.display.id IN :ids AND p.isPrimary = true")
    List<DisplayPhoto> findPrimaryByDisplayIdIn(@Param("ids") List<Long> ids);
}
