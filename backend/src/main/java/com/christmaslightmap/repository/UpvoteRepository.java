package com.christmaslightmap.repository;

import com.christmaslightmap.model.Upvote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface UpvoteRepository extends JpaRepository<Upvote, Long> {
    boolean existsByUserIdAndDisplayId(Long userId, Long displayId);

    @Transactional
    void deleteByUserIdAndDisplayId(Long userId, Long displayId);

    @Query("SELECT u FROM Upvote u JOIN FETCH u.display d WHERE u.user.id = :userId AND d.isActive = true")
    List<Upvote> findByUserIdWithActiveDisplays(@Param("userId") Long userId);
}
