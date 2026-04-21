package com.christmaslightmap.repository;

import com.christmaslightmap.model.DisplayPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DisplayPhotoRepository extends JpaRepository<DisplayPhoto, Long> {
    List<DisplayPhoto> findByDisplay_Id(Long displayId);
}
