package com.christmaslightmap.repository;

import com.christmaslightmap.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByProviderAndProviderId(String provider, String providerId);

    Optional<User> findByHandle(String handle);

    boolean existsByHandle(String handle);

    boolean existsByHandleAndIdNot(String handle, Long id);

    @Query("""
        SELECT DISTINCT u FROM User u
        WHERE (LOWER(u.displayName) LIKE LOWER(CONCAT('%', :q, '%'))
            OR LOWER(u.name) LIKE LOWER(CONCAT('%', :q, '%')))
          AND EXISTS (
            SELECT 1 FROM Listing l
            WHERE l.host.owner = u
              AND l.isActive = true
              AND l.endDatetime > :now
          )
        ORDER BY u.name ASC
        """)
    List<User> searchHosts(@Param("q") String q, @Param("now") LocalDateTime now);
}
